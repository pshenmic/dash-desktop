import { IpcMainInvokeEvent } from 'electron/utility'
import { AssetLockRecoveryService } from '../../services/platform/AssetLockRecoveryService'
import { AssetLockFundingState } from '../../types/AssetLockFunding'
import { AssetLockRecoveryDestination } from '../../types/AssetLockRecovery'

export class RecoverAssetLockHandler {
  constructor(private readonly assetLockRecoveryService: AssetLockRecoveryService) {}

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    txid: string,
    password: string,
    destination: AssetLockRecoveryDestination,
  ): Promise<AssetLockFundingState> => {
    return this.assetLockRecoveryService.recover(walletId, txid, password, destination)
  }
}
