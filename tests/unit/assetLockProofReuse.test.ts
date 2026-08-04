import {describe, it, expect, vi} from 'vitest'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AssetLockDAO} from '../../src/main/src/database/AssetLockDAO'
import {AssetLockService} from '../../src/main/src/services/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/PlatformWorkerService'
import {AssetLockFundingState} from '../../src/main/src/types/AssetLockFunding'
import {AssetLockProofParams} from '../../src/main/platform/types/messages'
import {AssetLockFundingRow, AssetLockFunder} from '../../src/main/src/types/AssetLock'
import {AssetLockFundingStatus} from '../../src/main/src/enums/AssetLockFundingStatus'

const INSTANT_PROOF: AssetLockProofParams = {type: 'instantLock', instantLock: 'aa', transaction: 'bb'}
const CHAIN_PROOF: AssetLockProofParams = {type: 'chainLock', coreChainLockedHeight: 4200}

const row = (assetLockProof: AssetLockProofParams | null): AssetLockFundingRow => ({
  id: 1,
  walletId: 'wallet-1',
  txid: 'assetlock-txid',
  outputIndex: 0,
  creditDerivationPath: "m/9'/1'/5'/1'/0",
  amountDuffs: 200_000n,
  toPlatformAddress: '',
  kind: 'identity',
  status: AssetLockFundingStatus.L1Broadcast,
  stHash: null,
  error: null,
  identityIndex: 0,
  txHex: null,
  assetLockProof,
  createdAt: 0,
})

const idleState = (): AssetLockFundingState => ({
  phase: 'waitingChainLock', kind: 'identity', txid: null, txHeight: null, chainLockedHeight: null,
  lockKind: null, stHash: null, toPlatformAddress: null, identityIdentifier: null,
  amountDuffs: null, error: null,
})

function serviceWith(waitForInstantLock = vi.fn()): {
  service: AssetLockService
  waitForInstantLock: ReturnType<typeof vi.fn>
} {
  const funder = {
    buildAndBroadcastAssetLock: vi.fn(),
    waitForInstantLock,
  } as unknown as AssetLockFunder

  const service = new AssetLockService(
    // Only reached once a funding has to wait for its lock.
    {getWalletById: vi.fn().mockResolvedValue(null)} as unknown as WalletDAO,
    {saveProof: vi.fn(), updateStatus: vi.fn()} as unknown as AssetLockDAO,
    funder,
    {request: vi.fn()} as unknown as PlatformWorkerService,
  )
  return {service, waitForInstantLock}
}

describe('reacquiring a funding whose proof is already stored', () => {
  it('returns the stored instant lock without waiting for one again', async () => {
    const {service, waitForInstantLock} = serviceWith()
    const state = idleState()

    const {proof} = await service.reacquire(state, row(INSTANT_PROOF))

    expect(proof).toEqual(INSTANT_PROOF)
    expect(state.lockKind).toBe('instant')
    expect(waitForInstantLock).not.toHaveBeenCalled()
  })

  it('restores the chain-locked height from a stored chain lock', async () => {
    const {service} = serviceWith()
    const state = idleState()

    const {proof} = await service.reacquire(state, row(CHAIN_PROOF))

    expect(proof).toEqual(CHAIN_PROOF)
    expect(state.lockKind).toBe('chain')
    expect(state.chainLockedHeight).toBe(4200)
  })

  // Without a stored proof the funding has to race the lock again, which starts
  // by resolving the wallet's network — the stub has none.
  it('falls back to waiting when the row has no proof', async () => {
    const {service} = serviceWith()

    await expect(service.reacquire(idleState(), row(null))).rejects.toThrow('Wallet not found')
  })
})