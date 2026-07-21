import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockService } from '../../services/AssetLockService'
import { AssetLockFundingState } from '../../types/AssetLockFunding'

export class GetAssetLockFundingStateHandler {
  private assetLockService: AssetLockService

  constructor(assetLockService: AssetLockService) {
    this.assetLockService = assetLockService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<AssetLockFundingState> => {
    return this.assetLockService.getState(walletId)
  }
}
