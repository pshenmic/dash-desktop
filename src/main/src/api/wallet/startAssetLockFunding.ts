import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockService, AssetLockFundingState } from '../../services/AssetLockService'

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
  ): Promise<AssetLockFundingState> => {
    return this.assetLockService.startFunding(walletId, toPlatformAddress, BigInt(amountDuffs), password)
  }
}
