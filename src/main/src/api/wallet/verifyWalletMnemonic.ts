import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletCredentialsService } from '../../services/wallet/WalletCredentialsService'

export class VerifyWalletMnemonicHandler {
  private credentials: WalletCredentialsService

  constructor(credentials: WalletCredentialsService) {
    this.credentials = credentials
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, mnemonic: string): Promise<boolean> => {
    return this.credentials.verifyWalletMnemonic(walletId, mnemonic)
  }
}
