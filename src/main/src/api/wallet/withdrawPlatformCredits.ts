import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformTransferService } from '../../services/platform/PlatformTransferService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class WithdrawPlatformCreditsHandler {
  private platformTransferService: PlatformTransferService

  constructor(platformTransferService: PlatformTransferService) {
    this.platformTransferService = platformTransferService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string | null,
    toCoreAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.platformTransferService.withdrawPlatformToCore(walletId, fromAddress, toCoreAddress, amountCredits, password)
  }
}
