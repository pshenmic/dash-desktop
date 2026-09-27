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
import {AssetLockService} from '../../src/main/src/services/platform/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {AssetLockFundingState} from '../../src/main/src/types/AssetLockFunding'
import {AssetLockProofParams} from '../../src/main/platform/types/messages'
import {AssetLockFundingRow, AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {AssetLockFundingStatus} from '../../src/main/src/enums/AssetLockFundingStatus'

const TXID = 'assetlock-txid'
const TX_HEIGHT = 4_200
const INSTANT_PROOF: AssetLockProofParams = {type: 'instantLock', instantLock: 'aa', transaction: 'bb'}
const STALE = new Error("Instant lock proof signature is invalid or wasn't created recently. Please try chain asset lock proof instead.")

const row = (): AssetLockFundingRow => ({
  id: 1,
  walletId: 'wallet-1',
  txid: TXID,
  outputIndex: 0,
  creditDerivationPath: "m/9'/1'/5'/1'/0",
  amountDuffs: 200_000n,
  toPlatformAddress: '',
  kind: 'identity',
  status: AssetLockFundingStatus.StBroadcast,
  stHash: null,
  error: null,
  identityIndex: 0,
  txHex: '00',
  assetLockProof: INSTANT_PROOF,
  createdAt: 0,
})

const state = (): AssetLockFundingState => ({
  phase: 'broadcastingST', kind: 'identity', txid: TXID, txHeight: null, chainLockedHeight: null,
  lockKind: 'instant', stHash: null, toPlatformAddress: null, identityIdentifier: null,
  amountDuffs: null, error: null,
})

function wire(): {
  service: AssetLockService
  dao: {clearProof: ReturnType<typeof vi.fn>; saveProof: ReturnType<typeof vi.fn>; updateStatus: ReturnType<typeof vi.fn>}
  waitForInstantLock: ReturnType<typeof vi.fn>
} {
  const waitForInstantLock = vi.fn().mockResolvedValue('cc')
  const funder = {
    waitForInstantLock,
    waitForChainLock: vi.fn().mockResolvedValue(5_000),
    chainlockedHeight: vi.fn().mockReturnValue(4_999),
    broadcastAssetLock: vi.fn(),
    getTxLockStatus: vi.fn().mockResolvedValue({instantLocked: true, chainlocked: false, confirmed: false}),
    getTransaction: vi.fn(),
  } as unknown as AssetLockFunder

  const dao = {clearProof: vi.fn(), saveProof: vi.fn(), updateStatus: vi.fn()}

  const service = new AssetLockService(
    {getWalletById: vi.fn().mockResolvedValue({walletId: 'wallet-1', network: 'testnet'})} as unknown as WalletDAO,
    dao as unknown as AssetLockDAO,
    funder,
    {request: vi.fn().mockResolvedValue({chain: {coreChainLockedHeight: TX_HEIGHT}})} as unknown as PlatformWorkerService,
  )

  return {service, dao, waitForInstantLock}
}

describe('a state transition Drive rejects for a stale instant lock', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stub.getTransaction.mockReset()
    stub.getTransaction.mockResolvedValue({height: TX_HEIGHT, isChainLocked: true})
    stub.createAssetLockProof.mockReset()
    stub.createAssetLockProof.mockImplementation(
      ({coreChainLockedHeight}: {coreChainLockedHeight: number}) => ({txid: TXID, coreChainLockedHeight}),
    )
  })

  afterEach(() => vi.restoreAllMocks())

  it('re-broadcasts against a chain lock proof', async () => {
    const {service} = wire()
    const broadcast = vi.fn()
      .mockRejectedValueOnce(STALE)
      .mockResolvedValue({stHash: 'st-hash'})

    const result = await service.broadcastWithProof(state(), row(), INSTANT_PROOF, broadcast)

    expect(result).toEqual({stHash: 'st-hash'})
    expect(broadcast).toHaveBeenNthCalledWith(1, INSTANT_PROOF)
    expect(broadcast).toHaveBeenNthCalledWith(2, {type: 'chainLock', coreChainLockedHeight: TX_HEIGHT})
  })

  // A second islock would be signed by the same rotated-out quorum, so racing
  // for one again only delays the proof that can still settle the funding.
  it('does not wait for another instant lock', async () => {
    const {service, waitForInstantLock} = wire()

    await service.broadcastWithProof(state(), row(), INSTANT_PROOF, vi.fn()
      .mockRejectedValueOnce(STALE)
      .mockResolvedValue({stHash: 'st-hash'}))

    expect(waitForInstantLock).not.toHaveBeenCalled()
  })

  // The stored proof is what a resume replays, so leaving it on the row is what
  // made the failure repeat forever.
  it('drops the stored proof and stores the chain lock in its place', async () => {
    const {service, dao} = wire()

    await service.broadcastWithProof(state(), row(), INSTANT_PROOF, vi.fn()
      .mockRejectedValueOnce(STALE)
      .mockResolvedValue({stHash: 'st-hash'}))

    expect(dao.clearProof).toHaveBeenCalledWith('wallet-1', TXID)
    expect(dao.saveProof).toHaveBeenCalledWith('wallet-1', TXID, {type: 'chainLock', coreChainLockedHeight: TX_HEIGHT})
    expect(dao.updateStatus.mock.calls.map(([, , status]) => status)).toEqual([
      AssetLockFundingStatus.L1Broadcast,
      AssetLockFundingStatus.ChainLocked,
      AssetLockFundingStatus.StBroadcast,
    ])
  })

  it('leaves the state on the state transition it is broadcasting', async () => {
    const {service} = wire()
    const s = state()

    await service.broadcastWithProof(s, row(), INSTANT_PROOF, vi.fn()
      .mockRejectedValueOnce(STALE)
      .mockResolvedValue({stHash: 'st-hash'}))

    expect(s.phase).toBe('broadcastingST')
    expect(s.lockKind).toBe('chain')
    expect(s.chainLockedHeight).toBe(TX_HEIGHT)
  })

  it('passes any other rejection straight through', async () => {
    const {service, dao} = wire()
    const broadcast = vi.fn().mockRejectedValue(new Error('Asset lock transaction output is already spent'))

    await expect(service.broadcastWithProof(state(), row(), INSTANT_PROOF, broadcast))
      .rejects.toThrow('already spent')
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(dao.clearProof).not.toHaveBeenCalled()
  })

  it('does not retry a chain lock proof against itself', async () => {
    const {service} = wire()
    const broadcast = vi.fn().mockRejectedValue(STALE)

    await expect(service.broadcastWithProof(state(), row(), {type: 'chainLock', coreChainLockedHeight: 10}, broadcast))
      .rejects.toThrow('created recently')
    expect(broadcast).toHaveBeenCalledTimes(1)
  })
})
