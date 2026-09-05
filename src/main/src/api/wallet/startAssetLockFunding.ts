import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockFundingState } from '../../types/AssetLockFunding'
import { IdentityRegistrationService } from '../../services/platform/IdentityRegistrationService'
import { PlatformTransferService } from '../../services/platform/PlatformTransferService'
import { ShieldedService } from '../../services/platform/ShieldedService'
import {AssetLockFundingKind} from '../../types/AssetLock'
import {CoreSpendSource} from '../../types/CoinSelection'

export class StartAssetLockFundingHandler {
  constructor(
    private readonly platformTransferService: PlatformTransferService,
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
    source?: CoreSpendSource,
  ): Promise<AssetLockFundingState> => {
    switch (kind ?? 'address') {
      case 'shielded':
        return this.shieldedService.startShieldFromL1(walletId, toPlatformAddress, amountDuffs, password, source)
      case 'identity':
        return this.identityRegistrationService.startIdentityCreate(walletId, amountDuffs, password, source)
      case 'identityTopUp':
        return this.identityRegistrationService.startIdentityTopUp(walletId, toPlatformAddress, amountDuffs, password, source)
      case 'address':
        return this.platformTransferService.startFundingFromL1(walletId, toPlatformAddress, amountDuffs, password, source)
    }
  }
}
