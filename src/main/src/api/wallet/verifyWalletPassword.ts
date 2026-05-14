import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'

export class VerifyWalletPasswordHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password: string): Promise<boolean> => {
    return this.walletService.verifyWalletPassword(walletId, password)
  }
}
