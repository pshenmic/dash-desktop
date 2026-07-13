import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { PlatformAddressEntry } from '../../types/PlatformAddress'

export class GetPlatformAddressesHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<PlatformAddressEntry[]> => {
    return this.platformAddressService.getPlatformAddresses(walletId)
  }
}
