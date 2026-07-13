import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class WithdrawPlatformCreditsHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string | null,
    toCoreAddress: string,
    amountCredits: string,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.platformAddressService.withdrawPlatformToCore(walletId, fromAddress, toCoreAddress, BigInt(amountCredits), password)
  }
}
