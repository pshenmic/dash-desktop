import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {EventEmitter} from 'events'
import {CFilterSyncWorker} from '../../src/main/p2p/sync/workers/CFilterSyncWorker'
import {deriveFilterHeader, hashFilter} from '../../src/main/p2p/utils/filterHeader'
import {displayHexToWire} from '../../src/main/p2p/utils/byteOrder'
import type {ChainStore} from '../../src/main/p2p/store/ChainStore'
import type {PoolService} from '../../src/main/p2p/net/PoolService'
import type {CFilterBatch} from '../../src/main/p2p/types/cfilterSync'
import type {PersistedHeader} from '../../src/main/p2p/types/chainStore'

const WALLET = 'wallet-1'
const TIP = 40

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

// A GCS filter over zero elements: one varint holding the count.
const EMPTY_FILTER = new Uint8Array([0])

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

class FakePool extends EventEmitter {
  sent: Array<{command: string}> = []
  peer = {host: '1.1.1.1', port: 19999, sendMessage: (m: {command: string}) => this.sent.push(m)}
  liar = {host: '2.2.2.2', port: 19999, sendMessage: (m: {command: string}) => this.sent.push(m)}
  readyPeers = new Set([this.peer, this.liar])
  filterCapablePeers = new Set([this.peer, this.liar])

  messages = {
    GetCFilters: () => ({command: 'getcfilters'}),
    GetCFHeaders: () => ({command: 'getcfheaders'}),
    GetCFCheckpt: () => ({command: 'getcfcheckpt'}),
    GetData: () => ({command: 'getdata'}),
  }

  countOf(command: string): number {
    return this.sent.filter(m => m.command === command).length
  }
}

describe('cfilter verification against the filter-header chain', () => {
  let pool: FakePool
  let worker: CFilterSyncWorker

  const setPhase = (phase: string): void => {
    ;(worker as unknown as {phase: string}).phase = phase
  }
  const batches = (): Map<number, CFilterBatch> =>
    (worker as unknown as {cfilter: {inflightBatches: Map<number, CFilterBatch>}}).cfilter.inflightBatches
  const filterHeaders = (): {set: (h: number, v: Uint8Array) => void; get: (h: number) => Uint8Array | undefined} =>
    (worker as unknown as {
      heightToFilterHeader: {set: (h: number, v: Uint8Array) => void; get: (h: number) => Uint8Array | undefined}
    }).heightToFilterHeader

  // Builds the chain the peer would have to be consistent with: header(h) is
  // derived from the filter it will serve, so a correct answer verifies and
  // anything else does not.
  const seedChainFor = (heights: number[], filter: Uint8Array): void => {
    const index = filterHeaders()
    for (let h = 1; h < heights[0]!; h++) index.set(h, wireAt(h))
    for (const h of heights) {
      index.set(h, deriveFilterHeader(hashFilter(filter), index.get(h - 1)!))
    }
  }

  const deliverFilter = (height: number, filter: Uint8Array, from = pool.peer): void => {
    pool.emit('peercfilter', from, {blockHash: displayHexToWire(hashAt(height)), filter})
  }

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()

    pool = new FakePool()
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
      cfilterCursor: TIP,
    })

    await worker.start()
    pool.sent = []
    setPhase('cfilters')
  })

  afterEach(() => {
    worker.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // The scan used to run ahead of the walk, matching filters it had no header
  // for. Holding is what makes the check below possible at all.
  it('holds the scan at a height whose filter header is unknown', () => {
    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])

    expect(pool.countOf('getcfilters')).toBe(0)
    expect(batches().size).toBe(0)
  })

  it('scans once the filter header for that height is known', () => {
    seedChainFor([TIP + 1], EMPTY_FILTER)
    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])

    expect(batches().get(TIP + 1)).toMatchObject({startHeight: TIP + 1, stopHeight: TIP + 1})
  })

  it('accepts a filter that hashes into its filter header', () => {
    seedChainFor([TIP + 1], EMPTY_FILTER)
    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])

    deliverFilter(TIP + 1, EMPTY_FILTER)

    expect(batches().size).toBe(0)
  })

  // Without this a peer serves a filter matching nothing, the block funding
  // this wallet is never fetched, and the payment simply never appears.
  it('rejects a filter that does not hash into its filter header', () => {
    seedChainFor([TIP + 1], EMPTY_FILTER)
    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])
    pool.sent = []

    deliverFilter(TIP + 1, new Uint8Array([0, 0, 0]), pool.liar)

    const batch = batches().get(TIP + 1)
    expect(batch).toBeDefined()
    expect([...batch!.remaining]).toEqual([TIP + 1])
    // Re-raced rather than left to time out.
    expect(pool.countOf('getcfilters')).toBeGreaterThan(0)
  })

  it('still accepts the honest answer after a forged one', () => {
    seedChainFor([TIP + 1], EMPTY_FILTER)
    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])

    deliverFilter(TIP + 1, new Uint8Array([0, 0, 0]), pool.liar)
    deliverFilter(TIP + 1, EMPTY_FILTER)

    expect(batches().size).toBe(0)
  })
})
