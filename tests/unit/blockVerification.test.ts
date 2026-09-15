import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {EventEmitter} from 'events'
import {Block, BlockHeader, Transaction} from 'dash-core-sdk'
import {CFilterSyncWorker} from '../../src/main/p2p/sync/workers/CFilterSyncWorker'
import {merkleRoot} from '../../src/main/p2p/utils/merkle'
import {displayHexToWire, wireToDisplayHex} from '../../src/main/p2p/utils/byteOrder'
import type {ChainStore} from '../../src/main/p2p/store/ChainStore'
import type {PoolService} from '../../src/main/p2p/net/PoolService'

const WALLET = 'wallet-1'
const TIP = 40
const HEIGHT = TIP + 1

const hashAt = (height: number): string => height.toString(16).padStart(64, '0')
const wireAt = (height: number): Uint8Array => {
  const wire = new Uint8Array(32)
  wire[0] = height & 0xff
  wire[1] = (height >> 8) & 0xff
  return wire
}

// version(4) + input count(0) + output count(0) + locktime(4). Only the bytes
// matter here — the tree is over serialised transactions, not over spendable
// ones.
const tx = (locktime: number): Transaction =>
  Transaction.fromBytes(new Uint8Array([2, 0, 0, 0, 0, 0, locktime, 0, 0, 0]))

const TXS = [tx(1), tx(2), tx(3)]
const ROOT = wireToDisplayHex(merkleRoot(TXS.map(t => displayHexToWire(t.hash())))!)
const HEADER = new BlockHeader(2, hashAt(TIP), ROOT, 1_760_000_000, 0x1e0fffff, 7)

const honest = (): Block => new Block(HEADER, TXS.length, TXS)
// The header the getdata asked for, over a transaction list one short.
const forged = (): Block => new Block(HEADER, TXS.length - 1, TXS.slice(0, -1))

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

// A block hash covers the 80-byte header and nothing else, so a peer can answer
// the getdata with the header we asked for and any transaction list it likes.
// Unchecked, dropping the transaction that pays this wallet makes the payment
// disappear for good — the scan moves past that height and never returns.
describe('block verification against the header merkle root', () => {
  let pool: FakePool
  let worker: CFilterSyncWorker

  const fetcher = (): {size: number; request: (h: number, w: Uint8Array) => void} =>
    (worker as unknown as {
      blockFetcher: {size: number; request: (h: number, w: Uint8Array) => void}
    }).blockFetcher
  const matched = (): Map<number, unknown> =>
    (worker as unknown as {matchedBlocks: Map<number, unknown>}).matchedBlocks

  const deliver = (block: Block, from = pool.peer): void => {
    pool.emit('peerblock', from, {block})
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
    ;(worker as unknown as {phase: string}).phase = 'cfilters'
    fetcher().request(HEIGHT, displayHexToWire(honest().hash()))
    pool.sent = []
  })

  afterEach(() => {
    worker.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('accepts a block whose transactions hash to its merkle root', () => {
    deliver(honest())

    expect(fetcher().size).toBe(0)
    expect(matched().has(HEIGHT)).toBe(true)
  })

  it('rejects a block carrying the right header over the wrong transactions', () => {
    deliver(forged(), pool.liar)

    expect(matched().has(HEIGHT)).toBe(false)
    expect(fetcher().size).toBe(1)
    // Re-requested rather than left to time out.
    expect(pool.countOf('getdata')).toBeGreaterThan(0)
  })

  it('still accepts the honest block after a forged one', () => {
    deliver(forged(), pool.liar)
    deliver(honest())

    expect(fetcher().size).toBe(0)
    expect((matched().get(HEIGHT) as Block | undefined)?.txs).toHaveLength(TXS.length)
  })

  it('ignores a forged block nobody asked for', () => {
    ;(worker as unknown as {blockFetcher: {reset: () => void}}).blockFetcher.reset()

    deliver(forged(), pool.liar)

    expect(matched().size).toBe(0)
    expect(pool.countOf('getdata')).toBe(0)
  })
})
