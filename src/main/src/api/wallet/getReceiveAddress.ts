import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'

export class GetReceiveAddressHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<string> => {
    return this.walletService.getReceiveAddress(walletId)
  }
}
