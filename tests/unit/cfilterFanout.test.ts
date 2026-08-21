import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {EventEmitter} from 'events'
import {CFilterSyncWorker} from '../../src/main/p2p/sync/workers/CFilterSyncWorker'
import {CFILTER_BATCH_PEERS, CFILTER_BATCH_TIMEOUT_MS} from '../../src/main/p2p/constants'
import type {ChainStore} from '../../src/main/p2p/store/ChainStore'
import type {PeerRotation} from '../../src/main/p2p/net/peerRotation'
import type {PoolService} from '../../src/main/p2p/net/PoolService'
import type {PersistedHeader} from '../../src/main/p2p/types/chainStore'

const WALLET = 'wallet-1'
const TIP = 40
const POOL_SIZE = 25

const hashAt = (height: number): string => height.toString(16).padStart(64, '0')
const wireAt = (height: number): Uint8Array => {
  const wire = new Uint8Array(32)
  wire[0] = height & 0xff
  wire[1] = (height >> 8) & 0xff
  return wire
}

const header = (height: number): PersistedHeader => ({
  height, hash: hashAt(height), prevHash: hashAt(height - 1),
  time: 1_760_000_000, nBits: 0x1e0fffff, raw: new Uint8Array(80),
})

class FakeChainStore {
  readonly network = 'testnet' as const
  forEachHashInRange = async (from: number, to: number, cb: (h: number, w: Uint8Array) => void): Promise<number> => {
    for (let h = from; h <= to; h++) cb(h, wireAt(h))
    return to - from + 1
  }
  forEachFilterHeaderInRange = async (): Promise<number> => 0
  writeFilterHeaders = async (): Promise<void> => undefined
  writeBackfillHashes = async (): Promise<void> => undefined
  iterateHeadersInRange = async (): Promise<Array<{height: number; raw: Uint8Array}>> => []
  deleteFilterHeadersFrom = async (): Promise<void> => undefined
}

interface FakePeer {
  host: string
  port: number
  sendMessage: (msg: {command: string}) => void
}

class FakePool extends EventEmitter {
  sentBy = new Map<FakePeer, Array<{command: string}>>()
  peers: FakePeer[] = []
  readyPeers = new Set<FakePeer>()
  filterCapablePeers = new Set<FakePeer>()

  constructor(size: number) {
    super()
    for (let i = 0; i < size; i++) {
      const peer: FakePeer = {
        host: `10.0.0.${i}`,
        port: 19999,
        sendMessage: (msg) => this.sentBy.get(peer)!.push(msg),
      }
      this.sentBy.set(peer, [])
      this.peers.push(peer)
      this.readyPeers.add(peer)
      this.filterCapablePeers.add(peer)
    }
  }

  reset(): void {
    for (const peer of this.peers) this.sentBy.set(peer, [])
  }

  peersAsked(command: string): FakePeer[] {
    return this.peers.filter(p => this.sentBy.get(p)!.some(m => m.command === command))
  }

  messages = {
    GetCFilters: () => ({command: 'getcfilters'}),
    GetCFHeaders: () => ({command: 'getcfheaders'}),
    GetCFCheckpt: () => ({command: 'getcfcheckpt'}),
    GetData: () => ({command: 'getdata'}),
  }
}

describe('cfilter batch fan-out', () => {
  let pool: FakePool
  let worker: CFilterSyncWorker

  const setPhase = (phase: string): void => {
    ;(worker as unknown as {phase: string}).phase = phase
  }

  // Stands in for the cfheaders walk: the scan refuses any height whose filter
  // header is unknown, because the filter that comes back could not be checked.
  const seedFilterHeaders = (through: number): void => {
    const index = (worker as unknown as {
      heightToFilterHeader: {set: (h: number, v: Uint8Array) => void}
    }).heightToFilterHeader
    for (let h = 1; h <= through; h++) index.set(h, wireAt(h))
  }

  type Rotations = {rotation: PeerRotation; blockRotation: PeerRotation}
  const cfRotation = (): PeerRotation => (worker as unknown as Rotations).rotation
  const blockRotation = (): PeerRotation => (worker as unknown as Rotations).blockRotation

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()

    pool = new FakePool(POOL_SIZE)
    worker = new CFilterSyncWorker({
      network: 'testnet',
      walletId: WALLET,
      chainStore: new FakeChainStore() as unknown as ChainStore,
      peerPool: pool as unknown as PoolService,
      chainTipHeight: TIP,
      chainTipHashDisplayHex: hashAt(TIP),
      watchAddresses: [],
      gapLimit: 20,
      birthdayHeight: 1,
      seedUtxos: [],
      cfilterCursor: TIP - 2,
    })

    await worker.start()
    pool.reset()
    seedFilterHeaders(TIP + 20)
  })

  afterEach(() => {
    worker.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('asks only CFILTER_BATCH_PEERS of the pool for a batch', () => {
    setPhase('cfilters')
    worker.onChainExtended([header(TIP + 1)])

    expect(pool.peersAsked('getcfilters')).toHaveLength(CFILTER_BATCH_PEERS)
    expect(CFILTER_BATCH_PEERS).toBeLessThan(POOL_SIZE)
  })

  // The peer set churns constantly. A batch whose only peers have dropped has
  // nobody left to answer it, so it must re-race at once rather than sit idle
  // until its timer fires — that timeout per request is what stalls a sync.
  it('re-races immediately when the last peer of a batch disconnects', () => {
    setPhase('cfilters')
    worker.onChainExtended([header(TIP + 1)])
    const asked = pool.peersAsked('getcfilters')
    pool.reset()

    for (const peer of asked) {
      pool.readyPeers.delete(peer)
      pool.filterCapablePeers.delete(peer)
      pool.emit('peerdisconnect', peer)
    }

    const retried = pool.peersAsked('getcfilters')
    expect(retried).toHaveLength(CFILTER_BATCH_PEERS)
    expect(retried.filter(p => asked.includes(p))).toHaveLength(0)
  })

  it('waits for the timer while a batch still has a live peer', () => {
    setPhase('cfilters')
    worker.onChainExtended([header(TIP + 1)])
    const asked = pool.peersAsked('getcfilters')
    pool.reset()

    // Only one of the two drops, so the other may still answer.
    pool.readyPeers.delete(asked[0]!)
    pool.filterCapablePeers.delete(asked[0]!)
    pool.emit('peerdisconnect', asked[0]!)

    expect(pool.peersAsked('getcfilters')).toHaveLength(0)
  })

  // Block fetches draw on readyPeers rather than the filter-capable subset, but
  // it is the same sockets — a peer that went silent on a cf* request should not
  // then be first in line for a block.
  it('skips peers that went silent when picking a block peer', () => {
    const first = pool.peers[0]!

    expect(blockRotation().first(new Set())).toBe(first)

    // Marked on the cf* rotation, read through the block one: the two share
    // their silence memory precisely so this carries across.
    cfRotation().markSilent([first as never])

    expect(blockRotation().first(new Set())).toBe(pool.peers[1])
  })

  it('falls back to a silent peer when it is the only one left', () => {
    const only = pool.peers[0]!
    for (const peer of pool.peers.slice(1)) pool.readyPeers.delete(peer)
    cfRotation().markSilent([only as never])

    expect(blockRotation().first(new Set())).toBe(only)
  })

  // A stalled peer must cost latency, not the batch: the retry has to reach
  // peers that were not asked the first time.
  it('rotates to untried peers when a batch times out', () => {
    setPhase('cfilters')
    worker.onChainExtended([header(TIP + 1)])
    const first = pool.peersAsked('getcfilters')

    vi.advanceTimersByTime(CFILTER_BATCH_TIMEOUT_MS + 1)

    const asked = pool.peersAsked('getcfilters')
    expect(asked.length).toBe(CFILTER_BATCH_PEERS * 2)
    expect(asked.filter(p => first.includes(p))).toHaveLength(CFILTER_BATCH_PEERS)
  })
})
