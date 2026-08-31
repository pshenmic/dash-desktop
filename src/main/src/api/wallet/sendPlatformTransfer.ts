import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformTransferService } from '../../services/platform/PlatformTransferService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class SendPlatformTransferHandler {
  private platformTransferService: PlatformTransferService

  constructor(platformTransferService: PlatformTransferService) {
    this.platformTransferService = platformTransferService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string,
    toAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.platformTransferService.sendPlatformTransfer(walletId, fromAddress, toAddress, amountCredits, password)
  }
}
