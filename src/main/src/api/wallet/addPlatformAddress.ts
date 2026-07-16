import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { PlatformAddressEntry } from '../../types/PlatformAddress'

export class AddPlatformAddressHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<PlatformAddressEntry[]> => {
    return this.platformAddressService.addPlatformAddress(walletId)
  }
}
