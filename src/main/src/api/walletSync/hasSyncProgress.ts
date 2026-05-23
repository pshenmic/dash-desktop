import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/WalletSyncService'

export class HasSyncProgressHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<boolean> => {
    return this.walletSyncService.hasSyncProgress(walletId)
  }
}
