import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'

export class VerifyWalletMnemonicHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, mnemonic: string): Promise<boolean> => {
    return this.walletService.verifyWalletMnemonic(walletId, mnemonic)
  }
}
