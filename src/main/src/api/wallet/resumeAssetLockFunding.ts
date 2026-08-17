import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockService } from '../../services/platform/AssetLockService'
import { AssetLockFundingState } from '../../types/AssetLockFunding'
import { IdentityRegistrationService } from '../../services/platform/IdentityRegistrationService'
import { PlatformAddressService } from '../../services/platform/PlatformAddressService'
import { ShieldedService } from '../../services/platform/ShieldedService'

export class ResumeAssetLockFundingHandler {
  constructor(
    private readonly assetLockService: AssetLockService,
    private readonly platformAddressService: PlatformAddressService,
    private readonly shieldedService: ShieldedService,
    private readonly identityRegistrationService: IdentityRegistrationService,
  ) {}

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password: string): Promise<AssetLockFundingState> => {
    const active = this.assetLockService.getActive(walletId)
    if (active != null) {
      return active
    }

    const row = await this.assetLockService.getResumable(walletId)
    if (row == null) {
      throw new Error('No funding to resume')
    }

    switch (row.kind) {
      case 'shielded':
        return this.shieldedService.resumeShieldFromL1(walletId, row, password)
      case 'identity':
      case 'identityTopUp':
        return this.identityRegistrationService.resume(walletId, row, password)
      case 'address':
        return this.platformAddressService.resumeFundingFromL1(walletId, row, password)
    }
  }
}