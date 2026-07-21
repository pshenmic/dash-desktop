import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockService } from '../../services/AssetLockService'
import { AssetLockFundingState } from '../../types/AssetLockFunding'

export class ResumeAssetLockFundingHandler {
  private assetLockService: AssetLockService

  constructor(assetLockService: AssetLockService) {
    this.assetLockService = assetLockService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password: string): Promise<AssetLockFundingState> => {
    return this.assetLockService.resumeFunding(walletId, password)
  }
}
