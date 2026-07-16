import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'

export class AddWalletAddressHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password: string, isChange: boolean): Promise<string> => {
    return this.walletService.addAddress(walletId, password, isChange)
  }
}
