import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class SendPlatformTransferHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string,
    toAddress: string,
    amountCredits: string,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.platformAddressService.sendPlatformTransfer(walletId, fromAddress, toAddress, BigInt(amountCredits), password)
  }
}
