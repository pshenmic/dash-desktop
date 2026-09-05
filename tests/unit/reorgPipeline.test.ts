import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

const captured = vi.hoisted(() => ({
  headerWorkers: [] as Array<Record<string, unknown>>,
  cfilterWorkers: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../src/main/p2p/store/ChainStore', () => ({
  ChainStore: class {
    network: string
    constructor(_path: string, network: string) {
      this.network = network
    }
    open = async (): Promise<void> => undefined
    close = async (): Promise<void> => undefined
    initSyncState = async (): Promise<{tipHeight: number; tipHash: string}> =>
      ({tipHeight: 100, tipHash: 'aa'.repeat(32)})
  },
}))

vi.mock('../../src/main/p2p/net/PoolService', async () => {
  const {EventEmitter} = await import('events')
  return {
    PoolService: class extends EventEmitter {
      network: string
      readyPeers = new Set()
      filterCapablePeers = new Set()
      messages = {}
      constructor(network: string) {
        super()
        this.network = network
      }
      start = (): void => undefined
      stop = (): void => undefined
      takeAddresses = (): unknown[] => []
      addAddresses = (): void => undefined
      addPeers = (): void => undefined
      dropPeers = (): void => undefined
    },
  }
})

vi.mock('../../src/main/p2p/sync/workers/HeaderSyncWorker', async () => {
  const {EventEmitter} = await import('events')
  return {
    HeaderSyncWorker: class extends EventEmitter {
      finalityHeights: number[] = []
      constructor() {
        super()
        captured.headerWorkers.push(this as unknown as Record<string, unknown>)
      }
      setFinalityHeight = (height: number): void => {
        this.finalityHeights.push(height)
      }
      start = async (): Promise<void> => undefined
      stop = (): void => undefined
    },
  }
})

vi.mock('../../src/main/p2p/sync/workers/CFilterSyncWorker', async () => {
  const {EventEmitter} = await import('events')
  return {
    CFilterSyncWorker: class extends EventEmitter {
      rewoundTo: number[] = []
      reseeded: unknown[][] = []
      constructor() {
        super()
        captured.cfilterWorkers.push(this as unknown as Record<string, unknown>)
      }
      onChainRewound = (height: number): void => {
        this.rewoundTo.push(height)
      }
      onChainExtended = (): void => undefined
      reseedUtxos = (utxos: unknown[]): void => {
        this.reseeded.push(utxos)
      }
      start = async (): Promise<void> => undefined
      stop = (): void => undefined
    },
  }
})

vi.mock('electron', () => ({
  utilityProcess: {
    fork: () => ({
      stdout: {on: () => undefined},
      stderr: {on: () => undefined},
      on: () => undefined,
      postMessage: (msg: unknown) => sentToChild.push(msg),
    }),
  },
}))
vi.mock('../../src/main/src/logger', () => ({logChildOutput: vi.fn()}))
vi.mock('fs', () => {
  const mocked = {mkdirSync: vi.fn(), promises: {rm: vi.fn().mockResolvedValue(undefined)}}
  return {...mocked, default: mocked}
})

import {SyncService} from '../../src/main/p2p/sync/SyncService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {Preferences} from '../../src/main/src/preferences'
import type {WalletSyncUtxo} from '../../src/main/p2p/types/walletSync'

const WALLET = 'wallet-1'
const sentToChild: unknown[] = []

const tick = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0))
}

const utxo = (n: number): WalletSyncUtxo => ({
  txid: n.toString(16).padStart(64, '0'),
  vout: 0,
  satoshis: '1000',
  address: 'yAddr',
  height: n,
})

describe('SyncService reorg forwarding', () => {
  let events: {
    chainRewound: ReturnType<typeof vi.fn>
    chainLocked: ReturnType<typeof vi.fn>
    status: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
  }
  let service: SyncService

  const headerWorker = (): Record<string, unknown> => captured.headerWorkers[captured.headerWorkers.length - 1]!
  const cfilterWorker = (): Record<string, unknown> => captured.cfilterWorkers[captured.cfilterWorkers.length - 1]!

  // The cfilter worker is only built once header sync reports 'synced'.
  const reachCFilterPhase = async (): Promise<void> => {
    ;(headerWorker() as unknown as {emit: (e: string, s: unknown) => void}).emit('status', {
      phase: 'synced',
      tipHeight: 100,
      tipHash: 'aa'.repeat(32),
      estimatedChainHeight: 100,
      peerCount: 1,
    })
    await tick()
  }

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    captured.headerWorkers.length = 0
    captured.cfilterWorkers.length = 0

    events = {chainRewound: vi.fn(), chainLocked: vi.fn(), status: vi.fn(), error: vi.fn()}
    service = new SyncService(events as never)

    await service.start({
      type: 'start',
      network: 'testnet',
      walletId: WALLET,
      chainDbPath: '/tmp/chain',
      watchAddresses: [],
      gapLimit: 20,
      seedUtxos: [],
      cfilterCursor: 90,
    })
    await reachCFilterPhase()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('drives the filter scan and main from one rewind', () => {
    ;(headerWorker() as unknown as {emit: (e: string, h: number) => void}).emit('chainRewound', 80)

    expect(cfilterWorker().rewoundTo).toEqual([80])
    expect(events.chainRewound).toHaveBeenCalledWith(WALLET, 80)
  })

  it('feeds the chainlock height to header sync as a reorg floor', () => {
    ;(service as unknown as {onClsig: (p: unknown, m: unknown) => void}).onClsig(null, {height: 95})

    expect(headerWorker().finalityHeights).toEqual([95])
  })

  it('passes a reseed through to the filter scan', () => {
    service.reseedUtxos({type: 'reseedUtxos', walletId: WALLET, utxos: [utxo(1)]})

    expect(cfilterWorker().reseeded).toEqual([[utxo(1)]])
  })

  it('ignores a reseed aimed at a different wallet', () => {
    service.reseedUtxos({type: 'reseedUtxos', walletId: 'other-wallet', utxos: [utxo(1)]})

    expect(cfilterWorker().reseeded).toEqual([])
  })
})

describe('WalletSyncService reorg persistence', () => {
  let transactionDAO: {
    applyBlock: ReturnType<typeof vi.fn>
    advanceCursor: ReturnType<typeof vi.fn>
    resetCursor: ReturnType<typeof vi.fn>
    rewindToHeight: ReturnType<typeof vi.fn>
    getUtxos: ReturnType<typeof vi.fn>
    getInitialScanComplete: ReturnType<typeof vi.fn>
  }
  let service: WalletSyncService
  let order: string[]

  const emit = (event: unknown): void => {
    ;(service as unknown as {handleP2PEvent: (e: unknown) => void}).handleP2PEvent(event)
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    sentToChild.length = 0
    order = []

    transactionDAO = {
      applyBlock: vi.fn().mockImplementation(async () => {
        order.push('applyBlock')
      }),
      advanceCursor: vi.fn().mockResolvedValue(undefined),
      resetCursor: vi.fn().mockResolvedValue(undefined),
      rewindToHeight: vi.fn().mockImplementation(async () => {
        order.push('rewindToHeight')
      }),
      getUtxos: vi.fn().mockImplementation(async () => {
        order.push('getUtxos')
        return [utxo(1)]
      }),
      getInitialScanComplete: vi.fn().mockResolvedValue(false),
    }

    const walletDAO = {getWalletById: vi.fn().mockResolvedValue({walletId: WALLET, network: 'testnet'})}
    service = new WalletSyncService(walletDAO as never, {} as never, transactionDAO as never, Preferences.default())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('un-confirms the orphaned blocks and answers with the rewound utxo set', async () => {
    emit({type: 'chainRewound', walletId: WALLET, height: 80})
    await tick()

    expect(transactionDAO.rewindToHeight).toHaveBeenCalledWith(WALLET, 80)
    expect(sentToChild.filter(m => (m as {type: string}).type !== 'setLogLevel'))
      .toEqual([{type: 'reseedUtxos', walletId: WALLET, utxos: [utxo(1)]}])
  })

  it('reads the utxo set only after the rewind has landed', async () => {
    emit({type: 'chainRewound', walletId: WALLET, height: 80})
    await tick()

    expect(order).toEqual(['rewindToHeight', 'getUtxos'])
  })

  // Both ride the same persist queue.
  it('undoes the orphaned blocks only after their own writes have landed', async () => {
    emit({
      type: 'blockApplied',
      block: {
        walletId: WALLET,
        height: 81,
        blockHash: 'hash-81',
        blockTime: 1_700_000_000,
        txs: [{txid: 'txid-81', raw: new Uint8Array([1]), inputs: [], outputs: []}],
        spends: [],
      },
    })
    emit({type: 'chainRewound', walletId: WALLET, height: 80})
    await tick()

    expect(order).toEqual(['applyBlock', 'rewindToHeight', 'getUtxos'])
  })

  it('does not reseed when the rewind fails, so the scan stays held', async () => {
    transactionDAO.rewindToHeight.mockRejectedValue(new Error('SQLITE_BUSY'))

    emit({type: 'chainRewound', walletId: WALLET, height: 80})
    await tick()

    expect(transactionDAO.getUtxos).not.toHaveBeenCalled()
    expect(sentToChild.filter(m => (m as {type: string}).type !== 'setLogLevel')).toEqual([])
  })
})

describe('WalletSyncService incoming mempool tx', () => {
  let transactionDAO: {
    recordPendingTx: ReturnType<typeof vi.fn>
    getPendingTxs: ReturnType<typeof vi.fn>
    getInitialScanComplete: ReturnType<typeof vi.fn>
  }
  let service: WalletSyncService

  const incoming = (txid: string): unknown => ({
    type: 'incomingTx',
    walletId: WALLET,
    tx: {txid, raw: new Uint8Array([1]), inputs: [], outputs: []},
  })

  const emit = (event: unknown): void => {
    ;(service as unknown as {handleP2PEvent: (e: unknown) => void}).handleP2PEvent(event)
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    sentToChild.length = 0

    transactionDAO = {
      recordPendingTx: vi.fn().mockResolvedValue(undefined),
      getPendingTxs: vi.fn().mockResolvedValue([]),
      getInitialScanComplete: vi.fn().mockResolvedValue(false),
    }
    const walletDAO = {getWalletById: vi.fn().mockResolvedValue({walletId: WALLET, network: 'testnet'})}
    service = new WalletSyncService(walletDAO as never, {} as never, transactionDAO as never, Preferences.default())
  })

  // Lock arming and rebroadcast both no-op without a child, which in production
  // the lock listener has already forked.
  const withChild = async (): Promise<void> => {
    await service.startLockListen('testnet')
    sentToChild.length = 0
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('records it as not ours', async () => {
    emit(incoming('aa'.repeat(32)))
    await tick()

    expect(transactionDAO.recordPendingTx).toHaveBeenCalledTimes(1)
    expect(transactionDAO.recordPendingTx.mock.calls[0][2]).toBe(false)
  })

  it('arms the lock watch so the isdlock can mark it final', async () => {
    await withChild()

    emit(incoming('aa'.repeat(32)))
    await tick()

    expect(sentToChild).toContainEqual({type: 'watchTxs', mode: 'add', txids: ['aa'.repeat(32)]})
  })

  // Re-pushing one would relay a stranger's transaction for as long as it
  // stays unconfirmed.
  it('never rebroadcasts a tx that is not ours', async () => {
    transactionDAO.getPendingTxs.mockResolvedValue([
      {txid: 'aa'.repeat(32), raw: new Uint8Array([1]), firstSeenAt: 0, instantLocked: false, isLocal: false},
      {txid: 'bb'.repeat(32), raw: new Uint8Array([2]), firstSeenAt: 0, instantLocked: false, isLocal: true},
    ])
    await withChild()
    ;(service as unknown as {activeWalletId: string}).activeWalletId = WALLET

    await (service as unknown as {rebroadcastPending: () => Promise<void>}).rebroadcastPending()

    const broadcasts = sentToChild.filter(m => (m as {type: string}).type === 'broadcast')
    expect(broadcasts).toHaveLength(1)
    expect((broadcasts[0] as {txHex: string}).txHex).toBe('02')
  })
})
