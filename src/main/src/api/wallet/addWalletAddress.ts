import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'

export class AddWalletAddressHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, isChange: boolean): Promise<string> => {
    return this.walletService.addAddress(walletId, isChange)
  }
}
