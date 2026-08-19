import {IpcMainInvokeEvent} from 'electron/utility'
import {AssetLockService} from '../../services/platform/AssetLockService'
import {AssetLockFundingState} from '../../types/AssetLockFunding'

export class DismissAssetLockFundingHandler {
  constructor(private readonly assetLockService: AssetLockService) {}

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<AssetLockFundingState> => {
    return this.assetLockService.dismiss(walletId)
  }
}
