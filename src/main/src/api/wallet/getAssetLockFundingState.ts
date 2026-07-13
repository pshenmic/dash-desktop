import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockService, AssetLockFundingState } from '../../services/AssetLockService'

export class GetAssetLockFundingStateHandler {
  private assetLockService: AssetLockService

  constructor(assetLockService: AssetLockService) {
    this.assetLockService = assetLockService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<AssetLockFundingState> => {
    return this.assetLockService.getState(walletId)
  }
}
