import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/WalletSyncService'
import {QueryStatus} from '../../types/QueryStatus'

export class StartWalletSyncHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<QueryStatus> => {
    return this.walletSyncService.startSync(walletId)
  }
}