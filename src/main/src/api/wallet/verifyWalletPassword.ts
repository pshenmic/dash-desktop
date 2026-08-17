import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletCredentialsService } from '../../services/wallet/WalletCredentialsService'

export class VerifyWalletPasswordHandler {
  private credentials: WalletCredentialsService

  constructor(credentials: WalletCredentialsService) {
    this.credentials = credentials
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password: string): Promise<boolean> => {
    return this.credentials.verifyWalletPassword(walletId, password)
  }
}
