import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { IdentityCreateResult } from '../../types/IdentityCreateResult'

export class CreateIdentityFromAddressesHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string | null,
    amountCredits: string,
    password: string,
  ): Promise<IdentityCreateResult> => {
    return this.platformAddressService.createIdentityFromAddresses(walletId, fromAddress, BigInt(amountCredits), password)
  }
}
