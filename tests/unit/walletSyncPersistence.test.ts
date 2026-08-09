import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('electron', () => ({utilityProcess: {fork: vi.fn()}}))
vi.mock('../../src/main/src/logger', () => ({logChildOutput: vi.fn()}))
// resetSync removes the on-disk chain store; the real call would delete the
// developer's actual ~/.dash-desktop chain database.
vi.mock('fs', () => {
  const mocked = {mkdirSync: vi.fn(), promises: {rm: vi.fn().mockResolvedValue(undefined)}}
  return {...mocked, default: mocked}
})

import {WalletSyncService} from '../../src/main/src/services/WalletSyncService'
import {Preferences} from '../../src/main/src/preferences'
import {GENESIS} from '../../src/main/p2p/constants'
import type {AppliedBlock} from '../../src/main/p2p/types/walletSync'
import type {Address} from '../../src/main/src/types/Address'

const WALLET = 'wallet-1'

const newAddress = (address: string, index: number): Address => ({
  walletId: WALLET,
  accountId: 0,
  address,
  derivationPath: `m/44'/1'/0'/0/${index}`,
  index,
  isChange: false,
  isUsed: false,
  label: null,
})

const block = (height: number): AppliedBlock => ({
  walletId: WALLET,
  height,
  blockHash: `hash-${height}`,
  blockTime: 1_700_000_000,
  txs: [{
    txid: `txid-${height}`,
    raw: new Uint8Array([1, 2, 3]),
    inputs: [],
    outputs: [{vout: 0, address: 'yAddr', satoshis: '1000', isMine: true}],
  }],
  spends: [],
})

// The p2p event handler is what the utility process drives; calling it
// directly avoids forking a real utility process.
const emit = (service: WalletSyncService, event: unknown): void => {
  ;(service as unknown as {handleP2PEvent: (e: unknown) => void}).handleP2PEvent(event)
}

const settle = async (): Promise<void> => {
  // Covers the two 1s retry sleeps in the applyBlock ladder.
  await vi.advanceTimersByTimeAsync(5_000)
}

describe('WalletSyncService block persistence', () => {
  let transactionDAO: {
    applyBlock: ReturnType<typeof vi.fn>
    advanceCursor: ReturnType<typeof vi.fn>
    resetCursor: ReturnType<typeof vi.fn>
    resetSyncDataByNetwork: ReturnType<typeof vi.fn>
    getInitialScanComplete: ReturnType<typeof vi.fn>
  }
  let walletDAO: {getWalletById: ReturnType<typeof vi.fn>}
  let service: WalletSyncService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    transactionDAO = {
      applyBlock: vi.fn().mockResolvedValue(undefined),
      advanceCursor: vi.fn().mockResolvedValue(undefined),
      resetCursor: vi.fn().mockResolvedValue(undefined),
      resetSyncDataByNetwork: vi.fn().mockResolvedValue(undefined),
      getInitialScanComplete: vi.fn().mockResolvedValue(false),
    }
    walletDAO = {getWalletById: vi.fn().mockResolvedValue({walletId: WALLET, network: 'testnet'})}
    service = new WalletSyncService(walletDAO as never, {} as never, transactionDAO as never, Preferences.default())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('advances the cursor to the scan tip when every block landed', async () => {
    emit(service, {type: 'blockApplied', block: block(500)})
    emit(service, {type: 'cursorAdvanced', walletId: WALLET, height: 1000})
    await settle()

    expect(transactionDAO.applyBlock).toHaveBeenCalledTimes(1)
    expect(transactionDAO.applyBlock.mock.calls[0][1]).toEqual({advanceCursor: true})
    expect(transactionDAO.advanceCursor).toHaveBeenCalledWith(WALLET, 1000)
    expect(service.getStatus().lastError).toBeNull()
  })

  it('holds the cursor below a block that failed to persist, and reports it', async () => {
    transactionDAO.applyBlock.mockRejectedValue(new Error('SQLITE_BUSY: database is locked'))

    emit(service, {type: 'blockApplied', block: block(500)})
    emit(service, {type: 'cursorAdvanced', walletId: WALLET, height: 1000})
    await settle()

    expect(transactionDAO.applyBlock).toHaveBeenCalledTimes(3)
    expect(transactionDAO.advanceCursor).toHaveBeenCalledTimes(1)
    expect(transactionDAO.advanceCursor).toHaveBeenCalledWith(WALLET, 499)

    const {lastError} = service.getStatus()
    expect(lastError).toContain('500')
    expect(lastError).toContain('SQLITE_BUSY')
  })

  it('stops a later block from carrying the cursor past the gap', async () => {
    transactionDAO.applyBlock.mockRejectedValueOnce(new Error('locked'))
      .mockRejectedValueOnce(new Error('locked'))
      .mockRejectedValueOnce(new Error('locked'))

    emit(service, {type: 'blockApplied', block: block(500)})
    emit(service, {type: 'blockApplied', block: block(501)})
    await settle()

    expect(transactionDAO.applyBlock).toHaveBeenCalledTimes(4)
    const lastCall = transactionDAO.applyBlock.mock.calls[3]
    expect(lastCall[0].height).toBe(501)
    expect(lastCall[1]).toEqual({advanceCursor: false})
  })

  it('clears the hold once the missing block lands on a rescan', async () => {
    transactionDAO.applyBlock.mockRejectedValueOnce(new Error('locked'))
      .mockRejectedValueOnce(new Error('locked'))
      .mockRejectedValueOnce(new Error('locked'))

    emit(service, {type: 'blockApplied', block: block(500)})
    await settle()
    expect(service.getStatus().lastError).not.toBeNull()

    emit(service, {type: 'blockApplied', block: block(500)})
    emit(service, {type: 'cursorAdvanced', walletId: WALLET, height: 1000})
    await settle()

    expect(transactionDAO.advanceCursor).toHaveBeenLastCalledWith(WALLET, 1000)
    expect(service.getStatus().lastError).toBeNull()
  })

  it('applies a discovery rewind after a stale advance already on the queue', async () => {
    let releaseBlock!: () => void
    transactionDAO.applyBlock.mockImplementationOnce(
      () => new Promise<void>(resolve => { releaseBlock = resolve })
    )

    emit(service, {type: 'blockApplied', block: block(500)})
    emit(service, {type: 'cursorAdvanced', walletId: WALLET, height: 900_000})
    const rewound = service.addWatchAddresses(WALLET, [newAddress('yNewAddr', 20)])
    await vi.advanceTimersByTimeAsync(0)
    releaseBlock()
    await settle()
    await rewound

    expect(transactionDAO.advanceCursor).toHaveBeenCalledWith(WALLET, 900_000)
    expect(transactionDAO.resetCursor).toHaveBeenCalledWith(WALLET, GENESIS.testnet.height)
    expect(transactionDAO.resetCursor.mock.invocationCallOrder[0])
      .toBeGreaterThan(transactionDAO.advanceCursor.mock.invocationCallOrder[0])
  })

  it('applies the worker rewind echo through the persist queue', async () => {
    let releaseBlock!: () => void
    transactionDAO.applyBlock.mockImplementationOnce(
      () => new Promise<void>(resolve => { releaseBlock = resolve })
    )

    emit(service, {type: 'blockApplied', block: block(500)})
    emit(service, {type: 'cursorAdvanced', walletId: WALLET, height: 900_000})
    emit(service, {type: 'cursorReset', walletId: WALLET, height: 100})
    await vi.advanceTimersByTimeAsync(0)
    releaseBlock()
    await settle()

    expect(transactionDAO.resetCursor).toHaveBeenLastCalledWith(WALLET, 100)
    expect(transactionDAO.resetCursor.mock.invocationCallOrder[0])
      .toBeGreaterThan(transactionDAO.advanceCursor.mock.invocationCallOrder[0])
  })

  // The worker stopped at the block that exhausted the gap and resumes from
  // there. Rewinding on top of that is what used to restart the whole scan.
  describe('gap-exhausted hold', () => {
    const gap = {walletId: WALLET, height: 500_000, isChange: false, lastUsedIndex: 51, maxIndex: 100}

    it('does not rewind the cursor for the addresses answering the hold', async () => {
      emit(service, {type: 'gapExhausted', gap})
      await settle()

      await service.addWatchAddresses(WALLET, [newAddress('yNewAddr', 101)])

      expect(transactionDAO.resetCursor).not.toHaveBeenCalled()
    })

    it('notifies main so discovery can run', async () => {
      const onGapExhausted = vi.fn()
      service.onGapExhausted = onGapExhausted

      emit(service, {type: 'gapExhausted', gap})
      await settle()

      expect(onGapExhausted).toHaveBeenCalledWith(gap)
    })

    it('rewinds again on the next add, once the hold is answered', async () => {
      emit(service, {type: 'gapExhausted', gap})
      await settle()
      await service.addWatchAddresses(WALLET, [newAddress('yNewAddr', 101)])

      await service.addWatchAddresses(WALLET, [newAddress('yLaterAddr', 102)])

      expect(transactionDAO.resetCursor).toHaveBeenCalledExactlyOnceWith(WALLET, GENESIS.testnet.height)
    })
  })

  it('drains queued writes before resetSync wipes the sync data', async () => {
    let releaseBlock!: () => void
    transactionDAO.applyBlock.mockImplementationOnce(
      () => new Promise<void>(resolve => { releaseBlock = resolve })
    )

    emit(service, {type: 'blockApplied', block: block(500)})
    const reset = service.resetSync('testnet')
    await vi.advanceTimersByTimeAsync(0)
    expect(transactionDAO.resetSyncDataByNetwork).not.toHaveBeenCalled()

    releaseBlock()
    await settle()
    await reset

    expect(transactionDAO.resetSyncDataByNetwork).toHaveBeenCalledWith('testnet')
  })

  it('keeps the persistence error visible across status pushes from the worker', async () => {
    transactionDAO.applyBlock.mockRejectedValue(new Error('locked'))

    emit(service, {type: 'blockApplied', block: block(500)})
    await settle()
    emit(service, {type: 'status', status: {...service.getStatus(), phase: 'synced', lastError: null}})

    expect(service.getStatus().phase).toBe('synced')
    expect(service.getStatus().lastError).toContain('500')
  })
})