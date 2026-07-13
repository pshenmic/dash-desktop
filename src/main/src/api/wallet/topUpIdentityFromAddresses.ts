import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class TopUpIdentityFromAddressesHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identityId: string,
    fromAddress: string | null,
    amountCredits: string,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.platformAddressService.topUpIdentityFromAddresses(walletId, identityId, fromAddress, BigInt(amountCredits), password)
  }
}
