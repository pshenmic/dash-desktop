import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletService} from '../../services/wallet/WalletService'

export class StartWalletSyncHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: unknown): Promise<void> => {
    if (typeof walletId !== 'string' || walletId === '') {
      throw new Error('startWalletSync: walletId is required')
    }
    return this.walletService.startWalletSync(walletId)
  }
}