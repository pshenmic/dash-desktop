import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('electron', () => ({utilityProcess: {fork: vi.fn()}}))
vi.mock('../../src/main/src/logger', () => ({logChildOutput: vi.fn()}))

import {WalletSyncService} from '../../src/main/src/services/WalletSyncService'
import type {AppliedBlock} from '../../src/main/p2p/types/walletSync'

const WALLET = 'wallet-1'

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
  let transactionDAO: {applyBlock: ReturnType<typeof vi.fn>; advanceCursor: ReturnType<typeof vi.fn>}
  let service: WalletSyncService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    transactionDAO = {
      applyBlock: vi.fn().mockResolvedValue(undefined),
      advanceCursor: vi.fn().mockResolvedValue(undefined),
    }
    service = new WalletSyncService({} as never, {} as never, transactionDAO as never)
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

  it('keeps the persistence error visible across status pushes from the worker', async () => {
    transactionDAO.applyBlock.mockRejectedValue(new Error('locked'))

    emit(service, {type: 'blockApplied', block: block(500)})
    await settle()
    emit(service, {type: 'status', status: {...service.getStatus(), phase: 'synced', lastError: null}})

    expect(service.getStatus().phase).toBe('synced')
    expect(service.getStatus().lastError).toContain('500')
  })
})