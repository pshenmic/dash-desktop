import {describe, expect, it, vi} from 'vitest'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AssetLockDAO} from '../../src/main/src/database/AssetLockDAO'
import {AssetLockService} from '../../src/main/src/services/platform/AssetLockService'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {AssetLockFunder, AssetLockFundingRow} from '../../src/main/src/types/AssetLock'
import {AssetLockFundingStatus} from '../../src/main/src/enums/AssetLockFundingStatus'
import {ASSET_LOCK_DISMISSED_ERROR} from '../../src/main/src/constants'

const FUNDING: AssetLockFundingRow = {
  id: 1,
  walletId: 'wallet-1',
  txid: 'assetlock-txid',
  outputIndex: 0,
  creditDerivationPath: "m/9'/1'/5'/1'/0",
  amountDuffs: 200_000n,
  toPlatformAddress: 'yTest',
  kind: 'address',
  status: AssetLockFundingStatus.L1Broadcast,
  stHash: null,
  error: null,
  identityIndex: null,
  txHex: null,
  assetLockProof: null,
  createdAt: 0,
}

function setup(row: AssetLockFundingRow | null): {
  service: AssetLockService
  getActiveFunding: ReturnType<typeof vi.fn>
  updateStatus: ReturnType<typeof vi.fn>
} {
  let active = row
  const getActiveFunding = vi.fn(async () => active)
  const updateStatus = vi.fn(async () => { active = null })
  const assetLockDAO = {getActiveFunding, updateStatus} as unknown as AssetLockDAO
  const service = new AssetLockService(
    {} as WalletDAO,
    assetLockDAO,
    {} as AssetLockFunder,
    {} as PlatformWorkerService,
  )
  return {service, getActiveFunding, updateStatus}
}

describe('asset lock funding dismissal', () => {
  it('marks persisted resumable funding as an error and returns to idle', async () => {
    const {service, updateStatus} = setup(FUNDING)

    await expect(service.dismiss(FUNDING.walletId)).resolves.toMatchObject({phase: 'idle'})
    expect(updateStatus).toHaveBeenCalledWith(
      FUNDING.txid,
      AssetLockFundingStatus.Error,
      {error: ASSET_LOCK_DISMISSED_ERROR},
    )
    await expect(service.getState(FUNDING.walletId)).resolves.toMatchObject({phase: 'idle'})
  })

  it('succeeds when there is no active persisted funding', async () => {
    const {service, updateStatus} = setup(null)

    await expect(service.dismiss('wallet-1')).resolves.toMatchObject({phase: 'idle'})
    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('rejects dismissal of a running in-memory funding job', async () => {
    const {service, getActiveFunding, updateStatus} = setup(null)
    await service.begin('wallet-1', 'address', 'yTest', 200_000n)
    getActiveFunding.mockClear()

    await expect(service.dismiss('wallet-1')).rejects.toThrow('Cannot dismiss funding while it is running')
    expect(getActiveFunding).not.toHaveBeenCalled()
    expect(updateStatus).not.toHaveBeenCalled()
  })
})
