import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/core/WalletSyncService'

export class StartWalletSyncHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<void> => {
    return this.walletSyncService.startSync(walletId)
  }
}