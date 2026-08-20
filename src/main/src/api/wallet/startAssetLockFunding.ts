import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockFundingState } from '../../types/AssetLockFunding'
import { IdentityRegistrationService } from '../../services/platform/IdentityRegistrationService'
import { PlatformAddressService } from '../../services/platform/PlatformAddressService'
import { ShieldedService } from '../../services/platform/ShieldedService'
import {AssetLockFundingKind} from '../../types/AssetLock'

export class StartAssetLockFundingHandler {
  constructor(
    private readonly platformAddressService: PlatformAddressService,
    private readonly shieldedService: ShieldedService,
    private readonly identityRegistrationService: IdentityRegistrationService,
  ) {}

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    toPlatformAddress: string,
    amountDuffs: bigint,
    password: string,
    kind?: AssetLockFundingKind,
  ): Promise<AssetLockFundingState> => {
    switch (kind ?? 'address') {
      case 'shielded':
        return this.shieldedService.startShieldFromL1(walletId, toPlatformAddress, amountDuffs, password)
      case 'identity':
        return this.identityRegistrationService.startIdentityCreate(walletId, amountDuffs, password)
      case 'identityTopUp':
        return this.identityRegistrationService.startIdentityTopUp(walletId, toPlatformAddress, amountDuffs, password)
      case 'address':
        return this.platformAddressService.startFundingFromL1(walletId, toPlatformAddress, amountDuffs, password)
    }
  }
}
