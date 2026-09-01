import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {EventEmitter} from 'events'
import {CFilterSyncWorker} from '../../src/main/p2p/sync/workers/CFilterSyncWorker'
import {CFILTER_BATCH_MAX_STALLS, CFILTER_BATCH_TIMEOUT_MS} from '../../src/main/p2p/constants'
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

class FakeChainStore {
  readonly network = 'testnet' as const
  rehashed = false

  forEachHashInRange = async (from: number, to: number, cb: (h: number, w: Uint8Array) => void): Promise<number> => {
    for (let h = from; h <= to; h++) cb(h, wireAt(h))
    return to - from + 1
  }
  forEachFilterHeaderInRange = async (): Promise<number> => 0
  writeFilterHeaders = async (): Promise<void> => undefined
  writeBackfillHashes = async (): Promise<void> => undefined
  deleteFilterHeadersFrom = async (): Promise<void> => undefined

  iterateHeadersInRange = async (): Promise<Array<{height: number; raw: Uint8Array}>> => {
    this.rehashed = true
    return []
  }
}

class FakePool extends EventEmitter {
  sent: Array<{command: string}> = []
  peer = {host: '1.1.1.1', port: 19999, sendMessage: (m: {command: string}) => this.sent.push(m)}
  readyPeers = new Set([this.peer])
  filterCapablePeers = new Set([this.peer])

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

describe('cfilter batch wedge', () => {
  let store: FakeChainStore
  let pool: FakePool
  let worker: CFilterSyncWorker

  const setPhase = (phase: string): void => {
    ;(worker as unknown as {phase: string}).phase = phase
  }
  const batches = (): Map<number, CFilterBatch> =>
    (worker as unknown as {cfilter: {inflightBatches: Map<number, CFilterBatch>}}).cfilter.inflightBatches

  // Stands in for the cfheaders walk: the scan refuses any height whose filter
  // header is unknown, because the filter that comes back could not be checked.
  const seedFilterHeaders = (through: number): void => {
    const index = (worker as unknown as {
      heightToFilterHeader: {set: (h: number, v: Uint8Array) => void}
    }).heightToFilterHeader
    for (let h = 1; h <= through; h++) index.set(h, wireAt(h))
  }

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()

    store = new FakeChainStore()
    pool = new FakePool()
    worker = new CFilterSyncWorker({
      network: 'testnet',
      walletId: WALLET,
      chainStore: store as unknown as ChainStore,
      peerPool: pool as unknown as PoolService,
      chainTipHeight: TIP,
      chainTipHashDisplayHex: hashAt(TIP),
      watchAddresses: [],
      gapLimit: 20,
      birthdayHeight: 1,
      seedUtxos: [],
      // Resume above the tip, so nothing is scanned until headers extend it.
      cfilterCursor: TIP,
    })

    await worker.start()
    pool.sent = []
    setPhase('cfilters')
    seedFilterHeaders(TIP + 20)
  })

  afterEach(() => {
    worker.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Genesis is never written to chain.db, so counting it as expected left the
  // cache one entry short forever and every launch re-walked the whole chain.
  it('accepts the cached hash chain without rehashing every header', () => {
    expect(store.rehashed).toBe(false)
  })

  // Concurrent tip-follow pushes can announce h+3 before h+1. A batch built
  // across the hole carries a height with no block hash, and a cfilter is
  // addressed by hash alone — so nothing could ever complete that batch.
  it('does not build a batch spanning a height the chain index is missing', () => {
    worker.onChainExtended([header(TIP + 3)])
    worker.onChainExtended([header(TIP + 4)])

    expect(pool.countOf('getcfilters')).toBe(0)
    expect(batches().size).toBe(0)
  })

  it('builds the batch once the skipped heights arrive', () => {
    worker.onChainExtended([header(TIP + 3)])
    worker.onChainExtended([header(TIP + 4)])
    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])

    const [batch] = [...batches().values()]
    expect(batch).toMatchObject({startHeight: TIP + 1, stopHeight: TIP + 3})
    expect([...batch!.remaining]).toEqual([TIP + 1, TIP + 2, TIP + 3])
    // Every height resolvable: the wedge was a height in `remaining` with no
    // hash registered for it.
    expect(batch!.hashToHeight.size).toBe(batch!.remaining.size)
  })

  // The batch above wedged for 26 hours in production, re-racing every 5s.
  it('rebuilds a batch nobody answers instead of re-racing it forever', () => {
    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])
    const original = batches().get(TIP + 1)
    expect(original).toBeDefined()

    vi.advanceTimersByTime(CFILTER_BATCH_TIMEOUT_MS * (CFILTER_BATCH_MAX_STALLS - 1))
    expect(batches().get(TIP + 1)).toBe(original)
    expect(original!.stalls).toBe(CFILTER_BATCH_MAX_STALLS - 1)

    vi.advanceTimersByTime(CFILTER_BATCH_TIMEOUT_MS)
    const rebuilt = batches().get(TIP + 1)
    expect(rebuilt).toBeDefined()
    expect(rebuilt).not.toBe(original)
    expect(rebuilt!.stalls).toBe(0)
  })

  // A batch stuck one filter short at the tip looks identical whether nobody
  // answered or nobody was asked; only the second is a peer-supply problem.
  it('reports a stall it could not dispatch as such', () => {
    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])
    pool.filterCapablePeers.clear()
    const before = pool.countOf('getcfilters')

    vi.advanceTimersByTime(CFILTER_BATCH_TIMEOUT_MS)

    const warned = vi.mocked(console.warn).mock.calls.map(call => String(call[0]))
    expect(warned.some(line => line.includes(`owed h=${TIP + 1}`) && line.includes('no peer to ask'))).toBe(true)
    expect(pool.countOf('getcfilters')).toBe(before)
  })

  it('reports a stall it did dispatch as a re-race', () => {
    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])

    vi.advanceTimersByTime(CFILTER_BATCH_TIMEOUT_MS)

    const warned = vi.mocked(console.warn).mock.calls.map(call => String(call[0]))
    expect(warned.some(line => line.includes(`owed h=${TIP + 1}`) && line.includes('re-racing'))).toBe(true)
  })

  // settledHeight() is the lowest inflight batch minus one, so a batch that
  // never clears pins the persisted cursor — which is what made every restart
  // rescan from a height hours behind the tip.
  it('does not pin the scan cursor behind an unanswerable batch', () => {
    const advanced: number[] = []
    worker.on('cursorAdvanced', (m: {height: number}) => advanced.push(m.height))

    worker.onChainExtended([header(TIP + 1), header(TIP + 2)])
    vi.advanceTimersByTime(CFILTER_BATCH_TIMEOUT_MS * (CFILTER_BATCH_MAX_STALLS + 1))

    const stuck = [...batches().values()].every(b => b.startHeight === TIP + 1)
    expect(stuck).toBe(true)
    // The range is retried from scratch rather than held open, so the scan is
    // free to settle as soon as a peer answers.
    expect(pool.countOf('getcfilters')).toBeGreaterThan(1)
    expect(advanced).toEqual([])
  })
})
