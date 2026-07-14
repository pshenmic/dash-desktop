import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class TransferIdentityCreditsHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromIdentityId: string,
    toIdentityId: string,
    amountCredits: string,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.platformAddressService.transferIdentityCredits(
      walletId,
      fromIdentityId,
      toIdentityId,
      BigInt(amountCredits),
      password,
    )
  }
}
