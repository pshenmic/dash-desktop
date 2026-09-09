import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformTransferService } from '../../services/platform/PlatformTransferService'
import { PlatformSendResult } from '../../types/PlatformSendResult'
import { PlatformSpendSource } from '../../types/PlatformTransfer'

export class TopUpIdentityFromAddressesHandler {
  private platformTransferService: PlatformTransferService

  constructor(platformTransferService: PlatformTransferService) {
    this.platformTransferService = platformTransferService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identityId: string,
    source: PlatformSpendSource | null,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.platformTransferService.topUpIdentityFromAddresses(walletId, identityId, source, amountCredits, password)
  }
}
