import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/WalletSyncService'
import {WalletSyncStatus} from '../../../p2p/messages'

export class GetWalletSyncStatusHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<WalletSyncStatus | null> => {
    return this.walletSyncService.getStatus()
  }
}