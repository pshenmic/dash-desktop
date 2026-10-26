import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

const stub = vi.hoisted(() => ({getTransaction: vi.fn()}))

vi.mock('dash-core-sdk', () => ({
  DashCoreSDK: class { getTransaction = stub.getTransaction },
}))

import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AssetLockDAO} from '../../src/main/src/database/AssetLockDAO'
import {AssetLockService} from '../../src/main/src/services/platform/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {AssetLockFundingState} from '../../src/main/src/types/AssetLockFunding'
import {AssetLockProofParams} from '../../src/main/platform/types/messages'
import {AssetLockFundingRow, AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {AssetLockFundingStatus} from '../../src/main/src/enums/AssetLockFundingStatus'

const TXID = 'assetlock-txid'
const TX_HEIGHT = 4_200
const INSTANT_PROOF: AssetLockProofParams = {type: 'instantLock', instantLock: 'aa', transaction: 'bb'}

const row = (overrides: Partial<AssetLockFundingRow> = {}): AssetLockFundingRow => ({
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
  ...overrides,
})

const state = (): AssetLockFundingState => ({
  phase: 'waitingChainLock', kind: 'identity', txid: TXID, txHeight: null, chainLockedHeight: null,
  lockKind: null, stHash: null, toPlatformAddress: null, identityIdentifier: null,
  amountDuffs: null, error: null,
})

function wire(): {
  service: AssetLockService
  funder: Record<string, ReturnType<typeof vi.fn>>
  dao: Record<string, ReturnType<typeof vi.fn>>
  request: ReturnType<typeof vi.fn>
} {
  const funder = {
    broadcastAssetLock: vi.fn(),
    waitForInstantLock: vi.fn(),
    waitForChainLock: vi.fn(),
  }
  const dao = {saveProof: vi.fn(), updateStatus: vi.fn()}
  const request = vi.fn().mockResolvedValue({chain: {coreChainLockedHeight: TX_HEIGHT}})

  const service = new AssetLockService(
    {getWalletById: vi.fn().mockResolvedValue({walletId: 'wallet-1', network: 'testnet'})} as unknown as WalletDAO,
    dao as unknown as AssetLockDAO,
    funder as unknown as AssetLockFunder,
    {request} as unknown as PlatformWorkerService,
  )
  return {service, funder, dao, request}
}

describe('resuming a funding', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    stub.getTransaction.mockReset()
    stub.getTransaction.mockResolvedValue({height: TX_HEIGHT, confirmations: 1})
  })

  afterEach(() => vi.restoreAllMocks())

  it('proves by chain lock at the block holding the tx once platform reaches it', async () => {
    const {service, funder, dao} = wire()
    const job = state()

    const {proof} = await service.reacquire(job, row())

    expect(proof).toEqual({type: 'chainLock', coreChainLockedHeight: TX_HEIGHT})
    expect(job.chainLockedHeight).toBe(TX_HEIGHT)
    expect(dao.saveProof).toHaveBeenCalledWith('wallet-1', TXID, proof)
    expect(funder.waitForInstantLock).not.toHaveBeenCalled()
    expect(funder.waitForChainLock).not.toHaveBeenCalled()
  })

  it('replaces a stored instant lock, which may be stale by now', async () => {
    const {service} = wire()

    const {proof} = await service.reacquire(state(), row({status: AssetLockFundingStatus.StBroadcast, assetLockProof: INSTANT_PROOF}))

    expect(proof).toEqual({type: 'chainLock', coreChainLockedHeight: TX_HEIGHT})
  })

  it('asks to wait while the transaction is unconfirmed', async () => {
    const {service, funder} = wire()
    stub.getTransaction.mockResolvedValue({height: 0, confirmations: 0})

    await expect(service.reacquire(state(), row())).rejects.toThrow(/please wait/)

    expect(funder.broadcastAssetLock).not.toHaveBeenCalled()
  })

  it('asks to wait while platform is behind the block holding the tx', async () => {
    const {service, request} = wire()
    request.mockResolvedValue({chain: {coreChainLockedHeight: TX_HEIGHT - 1}})

    await expect(service.reacquire(state(), row())).rejects.toThrow(/please wait/)
  })

  it('asks to wait while DAPI cannot see the transaction', async () => {
    const {service} = wire()
    stub.getTransaction.mockRejectedValue(new Error('No such mempool or blockchain transaction'))

    await expect(service.reacquire(state(), row())).rejects.toThrow(/please wait/)
  })
})
