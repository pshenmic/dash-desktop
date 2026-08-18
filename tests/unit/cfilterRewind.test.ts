import {describe, it, expect, beforeEach, vi} from 'vitest'
import {EventEmitter} from 'events'
import {CFilterSyncWorker} from '../../src/main/p2p/sync/workers/CFilterSyncWorker'
import {SCAN_TIP_DEPTH} from '../../src/main/p2p/constants'
import type {ChainStore} from '../../src/main/p2p/store/ChainStore'
import type {PoolService} from '../../src/main/p2p/net/PoolService'
import type {PersistedHeader} from '../../src/main/p2p/types/chainStore'
import type {WalletSyncUtxo} from '../../src/main/p2p/types/walletSync'

const WALLET = 'wallet-1'
const TIP = 40
const FORK = 30

const hashAt = (height: number): string => height.toString(16).padStart(64, '0')
const wireAt = (height: number): Uint8Array => {
  const wire = new Uint8Array(32)
  wire[0] = height & 0xff
  wire[1] = (height >> 8) & 0xff
  return wire
}

const utxo = (n: number): WalletSyncUtxo => ({
  txid: n.toString(16).padStart(64, '0'),
  vout: 0,
  satoshis: '100000',
  address: 'yTestAddressPlaceholder',
  height: n,
})

const header = (height: number): PersistedHeader => ({
  height,
  hash: hashAt(height),
  prevHash: hashAt(height - 1),
  time: 1_760_000_000,
  nBits: 0x1e0fffff,
  raw: new Uint8Array(80),
})

class FakeChainStore {
  readonly network = 'testnet' as const
  deletedFilterHeadersFrom: number[] = []

  forEachHashInRange = async (from: number, to: number, cb: (h: number, wire: Uint8Array) => void): Promise<number> => {
    for (let h = from; h <= to; h++) cb(h, wireAt(h))
    return to - from + 1
  }

  forEachFilterHeaderInRange = async (): Promise<number> => 0
  writeFilterHeaders = async (): Promise<void> => undefined
  writeBackfillHashes = async (): Promise<void> => undefined
  iterateHeadersInRange = async (): Promise<Array<{height: number; raw: Uint8Array}>> => []

  deleteFilterHeadersFrom = async (fromHeight: number): Promise<void> => {
    this.deletedFilterHeadersFrom.push(fromHeight)
  }
}

class FakePool extends EventEmitter {
  sent: Array<{command: string}> = []
  peer = {
    host: '1.1.1.1',
    port: 19999,
    sendMessage: (msg: {command: string}) => this.sent.push(msg),
  }

  readyPeers = new Set([this.peer])
  filterCapablePeers = new Set([this.peer])

  messages = {
    GetCFilters: () => ({command: 'getcfilters'}),
    GetCFHeaders: () => ({command: 'getcfheaders'}),
    GetCFCheckpt: () => ({command: 'getcfcheckpt'}),
    GetData: () => ({command: 'getdata'}),
  }
}

describe('CFilterSyncWorker rewind', () => {
  let store: FakeChainStore
  let pool: FakePool
  let worker: CFilterSyncWorker
  let cursorResets: Array<{walletId: string; height: number}>

  // The scan only pumps from 'cfilters' or 'synced'; reaching either for real
  // means driving cfcheckpt and the cfheaders walk.
  const setPhase = (phase: string): void => {
    ;(worker as unknown as {phase: string}).phase = phase
  }

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

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
      seedUtxos: [utxo(1), utxo(2)],
      cfilterCursor: 19,
    })

    cursorResets = []
    worker.on('cursorReset', (msg: {walletId: string; height: number}) => cursorResets.push(msg))

    await worker.start()
    pool.sent = []
  })

  it('reports the rewind as a cursor reset at the fork height', () => {
    worker.onChainRewound(FORK)

    expect(cursorResets).toEqual([{walletId: WALLET, height: FORK}])
  })

  it('drops the filter headers derived from the orphaned branch', () => {
    worker.onChainRewound(FORK)

    expect(store.deletedFilterHeadersFrom).toEqual([FORK + 1])
  })

  it('holds the scan until the rewound utxo set arrives', () => {
    setPhase('cfilters')
    worker.onChainExtended([header(TIP + 1)])
    expect(pool.sent.length).toBeGreaterThan(0)

    worker.onChainRewound(FORK)
    pool.sent = []

    // The spend map still reflects blocks that no longer exist.
    worker.onChainExtended([header(FORK + 1), header(FORK + 2)])

    expect(pool.sent).toEqual([])
  })

  it('resumes the scan once the utxo set is reseeded', () => {
    setPhase('cfilters')
    worker.onChainRewound(FORK)
    worker.onChainExtended([header(FORK + 1), header(FORK + 2)])
    pool.sent = []

    worker.reseedUtxos([utxo(3)])

    expect(pool.sent.length).toBeGreaterThan(0)
  })

  it('rescans from the fork rather than from where the orphaned scan reached', () => {
    setPhase('cfilters')
    worker.onChainExtended([header(TIP + 1)])
    pool.sent = []

    worker.onChainRewound(FORK)
    worker.reseedUtxos([])

    // Nothing above the fork is trusted, so the scan tip comes back down with it.
    const status = (worker as unknown as {
      effectiveScanTipHeight: () => number
    }).effectiveScanTipHeight()
    expect(status).toBe(FORK - SCAN_TIP_DEPTH)
  })

  it('is inert once stopped, so a late rewind cannot revive a torn-down worker', () => {
    worker.stop()

    worker.onChainRewound(FORK)
    worker.reseedUtxos([utxo(3)])

    expect(cursorResets).toEqual([])
    expect(store.deletedFilterHeadersFrom).toEqual([])
  })
})
