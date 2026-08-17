import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletCredentialsService } from '../../services/wallet/WalletCredentialsService'

export class ResetWalletPasswordHandler {
  private credentials: WalletCredentialsService

  constructor(credentials: WalletCredentialsService) {
    this.credentials = credentials
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, mnemonic: string, newPassword: string): Promise<boolean> => {
    return this.credentials.resetWalletPassword(walletId, mnemonic, newPassword)
  }
}
