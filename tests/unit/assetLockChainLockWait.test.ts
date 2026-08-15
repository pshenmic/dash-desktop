import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

const stub = vi.hoisted(() => ({
  getTransaction: vi.fn(),
  createAssetLockProof: vi.fn(),
}))

vi.mock('dash-core-sdk', () => ({
  DashCoreSDK: class { getTransaction = stub.getTransaction },
  InstantLock: {fromHex: vi.fn()},
  Transaction: {fromHex: vi.fn(() => ({}))},
  utils: {createAssetLockProof: stub.createAssetLockProof},
}))

import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AssetLockDAO} from '../../src/main/src/database/AssetLockDAO'
import {AssetLockService} from '../../src/main/src/services/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/PlatformWorkerService'
import {AssetLockFundingState} from '../../src/main/src/types/AssetLockFunding'
import {AssetLockFundingRow, AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {AssetLockFundingStatus} from '../../src/main/src/enums/AssetLockFundingStatus'

const TXID = 'assetlock-txid'
const TX_HEIGHT = 4_200

const row = (): AssetLockFundingRow => ({
  id: 1,
  walletId: 'wallet-1',
  txid: TXID,
  outputIndex: 0,
  creditDerivationPath: "m/9'/1'/5'/1'/0",
  amountDuffs: 200_000n,
  toPlatformAddress: '',
  kind: 'identity',
  status: AssetLockFundingStatus.L1Broadcast,
  stHash: null,
  error: null,
  identityIndex: 0,
  txHex: '00',
  assetLockProof: null,
  createdAt: 0,
})

const state = (): AssetLockFundingState => ({
  phase: 'waitingChainLock', kind: 'identity', txid: null, txHeight: null, chainLockedHeight: null,
  lockKind: null, stHash: null, toPlatformAddress: null, identityIdentifier: null,
  amountDuffs: null, error: null,
})

function wire(): {
  service: AssetLockService
  waitForChainLock: ReturnType<typeof vi.fn>
  request: ReturnType<typeof vi.fn>
} {
  // No islock ever arrives, so the chain-lock path decides every case here.
  const waitForChainLock = vi.fn().mockResolvedValue(5_000)
  const funder = {
    buildAndBroadcastAssetLock: vi.fn(),
    waitForInstantLock: vi.fn().mockResolvedValue(null),
    waitForChainLock,
    chainlockedHeight: vi.fn().mockReturnValue(4_999),
  } as unknown as AssetLockFunder

  const request = vi.fn().mockResolvedValue({chain: {coreChainLockedHeight: TX_HEIGHT}})

  const service = new AssetLockService(
    {getWalletById: vi.fn().mockResolvedValue({walletId: 'wallet-1', network: 'testnet'})} as unknown as WalletDAO,
    {saveProof: vi.fn(), updateStatus: vi.fn()} as unknown as AssetLockDAO,
    funder,
    {request} as unknown as PlatformWorkerService,
  )

  return {service, waitForChainLock, request}
}

describe('the chain-lock fallback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stub.getTransaction.mockReset()
    stub.createAssetLockProof.mockReset()
    stub.createAssetLockProof.mockImplementation(
      ({coreChainLockedHeight}: {coreChainLockedHeight: number}) => ({txid: TXID, coreChainLockedHeight}),
    )
  })

  afterEach(() => vi.restoreAllMocks())

  it('builds the proof once the tx is chainlocked and platform has caught up', async () => {
    stub.getTransaction.mockResolvedValue({isChainLocked: true, height: TX_HEIGHT})

    const {service} = wire()
    const {proof} = await service.reacquire(state(), row())

    expect(proof).toEqual({type: 'chainLock', coreChainLockedHeight: TX_HEIGHT})
  })

  // The point of the rewrite: between two clsigs, re-asking DAPI can only
  // return what it already returned.
  it('re-reads the transaction only after a chainlock advances', async () => {
    stub.getTransaction
      .mockResolvedValueOnce({isChainLocked: false, height: 0})
      .mockResolvedValue({isChainLocked: true, height: TX_HEIGHT})

    const {service, waitForChainLock} = wire()
    await service.reacquire(state(), row())

    expect(stub.getTransaction).toHaveBeenCalledTimes(2)
    expect(waitForChainLock).toHaveBeenCalledTimes(1)
    // Capped well under the ~2.5 min block interval, so DAPI still reporting
    // the tx unlocked costs seconds rather than a whole block.
    const [, , waited] = waitForChainLock.mock.calls[0] as [string, number, number]
    expect(waited).toBeLessThanOrEqual(60_000)
  })

  // A height pinned on one observation survives the tx being reorged out of
  // the block it reports.
  it('uses the height from the latest read, not the first', async () => {
    stub.getTransaction
      .mockResolvedValueOnce({isChainLocked: true, height: 9_999})
      .mockResolvedValue({isChainLocked: true, height: TX_HEIGHT})

    const {service, request} = wire()
    request.mockResolvedValueOnce({chain: {coreChainLockedHeight: 100}})

    await service.reacquire(state(), row())

    expect(stub.createAssetLockProof).toHaveBeenCalledWith(
      expect.objectContaining({coreChainLockedHeight: TX_HEIGHT}),
    )
  })

  it('waits rather than proving against a platform node that has not caught up', async () => {
    stub.getTransaction.mockResolvedValue({isChainLocked: true, height: TX_HEIGHT})

    const {service, request, waitForChainLock} = wire()
    request.mockResolvedValueOnce({chain: {coreChainLockedHeight: TX_HEIGHT - 1}})

    await service.reacquire(state(), row())

    expect(waitForChainLock).toHaveBeenCalledTimes(1)
    expect(stub.createAssetLockProof).toHaveBeenCalledTimes(1)
  })

  it('survives a platform node status outage', async () => {
    stub.getTransaction.mockResolvedValue({isChainLocked: true, height: TX_HEIGHT})

    const {service, request} = wire()
    request.mockRejectedValueOnce(new Error('evonode unreachable'))

    const {proof} = await service.reacquire(state(), row())

    expect(proof).toEqual({type: 'chainLock', coreChainLockedHeight: TX_HEIGHT})
  })

  it('keeps waiting while the transaction is not visible on DAPI', async () => {
    stub.getTransaction
      .mockRejectedValueOnce(new Error('No such mempool or blockchain transaction'))
      .mockResolvedValue({isChainLocked: true, height: TX_HEIGHT})

    const {service} = wire()
    const {proof} = await service.reacquire(state(), row())

    expect(proof).toEqual({type: 'chainLock', coreChainLockedHeight: TX_HEIGHT})
  })

  // Previously a bare catch swallowed this and the caller was told, fifteen
  // minutes later, that it had timed out waiting.
  it('surfaces a proof that cannot be built instead of retrying until the deadline', async () => {
    stub.getTransaction.mockResolvedValue({isChainLocked: true, height: TX_HEIGHT})
    stub.createAssetLockProof.mockImplementation(() => { throw new Error('malformed outpoint') })

    const {service} = wire()

    await expect(service.reacquire(state(), row())).rejects.toThrow('malformed outpoint')
  })

  it('gives up with a timeout once the clsig stream stops answering', async () => {
    stub.getTransaction.mockResolvedValue({isChainLocked: false, height: 0})

    const {service, waitForChainLock} = wire()
    ;(waitForChainLock as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 16 * 60 * 1000)
      return null
    })
    vi.useFakeTimers()

    await expect(service.reacquire(state(), row())).rejects.toThrow('Timed out waiting for asset lock proof')

    vi.useRealTimers()
  })
})
