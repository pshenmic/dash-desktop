import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/WalletSyncService'
import {WalletSyncStatus} from '../../../p2p/messages'

export class StartWalletSyncHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<WalletSyncStatus | null> => {
    return this.walletSyncService.startSync(walletId)
  }
}