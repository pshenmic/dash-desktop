import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class SendIdentityCreditsHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identityId: string,
    toAddress: string,
    amountCredits: string,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.platformAddressService.sendIdentityCreditsToAddresses(
      walletId,
      identityId,
      [{address: toAddress, amountCredits: BigInt(amountCredits)}],
      password,
    )
  }
}
