import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/WalletSyncService'
import {WalletUtxoDetailed} from '../../types/WalletUtxoDetailed'

export class GetUtxosDetailedHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<WalletUtxoDetailed[]> => {
    return this.walletSyncService.getUtxosDetailed(walletId)
  }
}
