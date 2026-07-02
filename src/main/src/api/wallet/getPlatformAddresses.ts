import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { PlatformAddressEntry } from '../../types/PlatformAddress'

export class GetPlatformAddressesHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<PlatformAddressEntry[]> => {
    return this.walletService.getPlatformAddresses(walletId)
  }
}
