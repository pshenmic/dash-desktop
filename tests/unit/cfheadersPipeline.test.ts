import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {EventEmitter} from 'events'
import {CFilterSyncWorker} from '../../src/main/p2p/sync/workers/CFilterSyncWorker'
import {MAX_INFLIGHT_CFHEADERS} from '../../src/main/p2p/constants'
import type {ChainStore} from '../../src/main/p2p/store/ChainStore'
import type {PoolService} from '../../src/main/p2p/net/PoolService'

// The cfheaders walk is a round trip per 1000 blocks and nothing else — with one
// request outstanding it is neither CPU nor bandwidth bound, just latency times
// the number of chunks. Chunks sit between two cfcheckpt anchors, so they are
// verified independently and can be in flight together.

const TIP = (MAX_INFLIGHT_CFHEADERS + 5) * 1000
const hashAt = (height: number): string => height.toString(16).padStart(64, '0')
const wireAt = (height: number): Uint8Array => {
  const wire = new Uint8Array(32)
  wire[0] = height & 0xff
  wire[1] = (height >> 8) & 0xff
  wire[2] = (height >> 16) & 0xff
  return wire
}

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
  sent: Array<{command: string}> = []
  peers: FakePeer[] = []
  readyPeers = new Set<FakePeer>()
  filterCapablePeers = new Set<FakePeer>()

  constructor(size: number) {
    super()
    for (let i = 0; i < size; i++) {
      const peer: FakePeer = {host: `10.0.0.${i}`, port: 19999, sendMessage: (m) => this.sent.push(m)}
      this.peers.push(peer)
      this.readyPeers.add(peer)
      this.filterCapablePeers.add(peer)
    }
  }

  messages = {
    GetCFilters: () => ({command: 'getcfilters'}),
    GetCFHeaders: () => ({command: 'getcfheaders'}),
    GetCFCheckpt: () => ({command: 'getcfcheckpt'}),
    GetData: () => ({command: 'getdata'}),
  }
}

describe('cfheaders pipelining', () => {
  let pool: FakePool
  let worker: CFilterSyncWorker

  type Internals = {
    cfHeaders: {walkStart: number; pending: Map<number, unknown>}
    phase: string
    walkCFHeadersNext: () => void
  }
  const inner = (): Internals => worker as unknown as Internals

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    pool = new FakePool(8)
    worker = new CFilterSyncWorker({
      network: 'testnet',
      walletId: 'wallet-1',
      chainStore: new FakeChainStore() as unknown as ChainStore,
      peerPool: pool as unknown as PoolService,
      chainTipHeight: TIP,
      chainTipHashDisplayHex: hashAt(TIP),
      watchAddresses: [],
      gapLimit: 20,
      birthdayHeight: 1,
      seedUtxos: [],
      cfilterCursor: null,
    })
    await worker.start()
    pool.sent = []
  })

  afterEach(() => {
    worker.stop()
    vi.restoreAllMocks()
  })

  const requests = (): number => pool.sent.filter(m => m.command === 'getcfheaders').length

  it('keeps many chunks in flight rather than one', () => {
    inner().cfHeaders.walkStart = 1

    inner().walkCFHeadersNext()

    expect(inner().cfHeaders.pending.size).toBe(MAX_INFLIGHT_CFHEADERS)
    expect(MAX_INFLIGHT_CFHEADERS).toBeGreaterThan(1)
  })

  it('requests each chunk from its own set of peers', () => {
    inner().cfHeaders.walkStart = 1

    inner().walkCFHeadersNext()

    // One dispatch per chunk, each fanned out across the race width.
    expect(requests()).toBeGreaterThanOrEqual(MAX_INFLIGHT_CFHEADERS)
  })

  it('covers consecutive checkpoint-aligned ranges without gaps', () => {
    inner().cfHeaders.walkStart = 1

    inner().walkCFHeadersNext()

    const stops = [...inner().cfHeaders.pending.keys()].sort((a, b) => a - b)
    expect(stops[0]).toBe(1000)
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i]! - stops[i - 1]!).toBe(1000)
    }
  })

  it('does not start the scan while chunks are still outstanding', () => {
    inner().cfHeaders.walkStart = 1
    inner().walkCFHeadersNext()
    expect(inner().cfHeaders.pending.size).toBeGreaterThan(0)

    // Everything below the tip has been requested, but nothing has come back.
    inner().cfHeaders.walkStart = TIP + 1
    inner().walkCFHeadersNext()

    expect(inner().phase).not.toBe('cfilters')
  })

  it('starts the scan once the pipeline has drained', () => {
    inner().cfHeaders.walkStart = TIP + 1
    inner().cfHeaders.pending.clear()

    inner().walkCFHeadersNext()

    expect(inner().phase).toBe('cfilters')
  })
})
