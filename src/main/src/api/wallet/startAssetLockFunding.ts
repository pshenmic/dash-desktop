import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockService } from '../../services/AssetLockService'
import { AssetLockFundingState } from '../../types/AssetLockFunding'
import { AssetLockFundingKind } from '../../database/AssetLockDAO'

export class StartAssetLockFundingHandler {
  private assetLockService: AssetLockService

  constructor(assetLockService: AssetLockService) {
    this.assetLockService = assetLockService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    toPlatformAddress: string,
    amountDuffs: string,
    password: string,
    kind?: AssetLockFundingKind,
  ): Promise<AssetLockFundingState> => {
    return this.assetLockService.startFunding(walletId, toPlatformAddress, BigInt(amountDuffs), password, kind ?? 'address')
  }
}
