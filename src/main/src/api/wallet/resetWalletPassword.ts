import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'

export class ResetWalletPasswordHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, mnemonic: string, newPassword: string): Promise<boolean> => {
    return this.walletService.resetWalletPassword(walletId, mnemonic, newPassword)
  }
}
