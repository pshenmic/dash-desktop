import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockRecoveryService } from '../../services/platform/AssetLockRecoveryService'
import { AssetLockInspection } from '../../types/AssetLockRecovery'

export class InspectAssetLockHandler {
  constructor(private readonly assetLockRecoveryService: AssetLockRecoveryService) {}

  handle = async (_event: IpcMainInvokeEvent, walletId: string, txid: string): Promise<AssetLockInspection> => {
    return this.assetLockRecoveryService.inspect(walletId, txid)
  }
}
