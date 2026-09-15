import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {EventEmitter} from 'events'
import {CFilterSyncWorker} from '../../src/main/p2p/sync/workers/CFilterSyncWorker'
import type {ChainStore} from '../../src/main/p2p/store/ChainStore'
import type {PoolService} from '../../src/main/p2p/net/PoolService'
import type {WalletSyncUtxo} from '../../src/main/p2p/types/walletSync'

const TIP = 40
const hashAt = (height: number): string => height.toString(16).padStart(64, '0')

class FakeChainStore {
  readonly network = 'testnet' as const
  forEachHashInRange = async (from: number, to: number, cb: (h: number, w: Uint8Array) => void): Promise<number> => {
    for (let h = from; h <= to; h++) {
      const wire = new Uint8Array(32)
      wire[0] = h & 0xff
      cb(h, wire)
    }
    return to - from + 1
  }
  forEachFilterHeaderInRange = async (): Promise<number> => 0
  writeFilterHeaders = async (): Promise<void> => undefined
  writeBackfillHashes = async (): Promise<void> => undefined
  iterateHeadersInRange = async (): Promise<Array<{height: number; raw: Uint8Array}>> => []
  deleteFilterHeadersFrom = async (): Promise<void> => undefined
}

class FakePool extends EventEmitter {
  readyPeers = new Set<object>()
  filterCapablePeers = new Set<object>()
  messages = {
    GetCFilters: () => ({command: 'getcfilters'}),
    GetCFHeaders: () => ({command: 'getcfheaders'}),
    GetCFCheckpt: () => ({command: 'getcfcheckpt'}),
    GetData: () => ({command: 'getdata'}),
  }
}

const utxo = (txid: string, satoshis: string): WalletSyncUtxo =>
  ({txid, vout: 0, satoshis, address: 'yaddr', height: 2})

// Tip-follow drops the worker back into 'cfilters' for every block, so the scan
// completes once every ~2.5 minutes for as long as the wallet is open. The log
// carried 718 consecutive copies of one unchanged balance.
describe('scan completion reporting', () => {
  let pool: FakePool
  let worker: CFilterSyncWorker
  let info: ReturnType<typeof vi.spyOn>

  const finish = async (): Promise<void> => {
    ;(worker as unknown as {phase: string}).phase = 'cfilters'
    await (worker as unknown as {maybeDrainAndFinish: () => Promise<void>}).maybeDrainAndFinish()
  }
  const completions = (): string[] =>
    info.mock.calls.map(args => String(args[0])).filter(line => line.includes('scan complete'))

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    pool = new FakePool()
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
      seedUtxos: [utxo('aa', '1000')],
      cfilterCursor: TIP,
    })
    await worker.start()
    info.mockClear()
  })

  afterEach(() => {
    worker.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reports the totals the first time the scan reaches the tip', async () => {
    await finish()

    expect(completions()).toHaveLength(1)
    expect(completions()[0]).toContain('utxos=1 balance=1000 sats')
  })

  it('says nothing on a completion that moved neither total', async () => {
    await finish()
    await finish()
    await finish()

    expect(completions()).toHaveLength(1)
  })

  it('reports again once the balance moves', async () => {
    await finish()
    ;(worker as unknown as {watchSet: {setUtxos: (u: WalletSyncUtxo[]) => void}})
      .watchSet.setUtxos([utxo('aa', '1000'), utxo('bb', '250')])

    await finish()

    expect(completions()).toHaveLength(2)
    expect(completions()[1]).toContain('utxos=2 balance=1250 sats')
  })
})
