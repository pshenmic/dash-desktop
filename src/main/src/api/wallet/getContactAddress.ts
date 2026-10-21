import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'

export class GetContactAddressHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identifier: string,
    contactId: string,
    password: string,
  ): Promise<string> => {
    return this.walletService.getContactAddress(walletId, identifier, contactId, password)
  }
}
