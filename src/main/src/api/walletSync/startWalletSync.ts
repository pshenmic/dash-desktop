import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/core/WalletSyncService'

export class StartWalletSyncHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: unknown): Promise<void> => {
    if (typeof walletId !== 'string' || walletId === '') {
      throw new Error('startWalletSync: walletId is required')
    }
    return this.walletSyncService.startSync(walletId)
  }
}