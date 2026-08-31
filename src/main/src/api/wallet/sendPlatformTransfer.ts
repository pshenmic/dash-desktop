import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformTransferService } from '../../services/platform/PlatformTransferService'
import { PlatformSendResult } from '../../types/PlatformSendResult'
import { PlatformSpendSource } from '../../types/PlatformTransfer'
import { Recipient } from '../../../platform/types/messages'

export class SendPlatformTransferHandler {
  private platformTransferService: PlatformTransferService

  constructor(platformTransferService: PlatformTransferService) {
    this.platformTransferService = platformTransferService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    source: PlatformSpendSource | null,
    recipients: Recipient[],
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.platformTransferService.sendPlatformTransfer(walletId, source, recipients, password)
  }
}
