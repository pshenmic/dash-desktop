import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockFundingState } from '../../types/AssetLockFunding'
import { IdentityRegistrationService } from '../../services/IdentityRegistrationService'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { ShieldedService } from '../../services/ShieldedService'
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
    amountDuffs: string,
    password: string,
    kind?: AssetLockFundingKind,
  ): Promise<AssetLockFundingState> => {
    const amount = BigInt(amountDuffs)

    switch (kind ?? 'address') {
      case 'shielded':
        return this.shieldedService.startShieldFromL1(walletId, toPlatformAddress, amount, password)
      case 'identity':
        return this.identityRegistrationService.startIdentityCreate(walletId, amount, password)
      case 'identityTopUp':
        return this.identityRegistrationService.startIdentityTopUp(walletId, toPlatformAddress, amount, password)
      case 'address':
        return this.platformAddressService.startFundingFromL1(walletId, toPlatformAddress, amount, password)
    }
  }
}