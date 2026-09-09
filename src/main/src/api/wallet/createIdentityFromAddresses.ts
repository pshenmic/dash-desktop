import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformTransferService } from '../../services/platform/PlatformTransferService'
import { IdentityCreateResult } from '../../types/IdentityCreateResult'
import { PlatformSpendSource } from '../../types/PlatformTransfer'

export class CreateIdentityFromAddressesHandler {
  private platformTransferService: PlatformTransferService

  constructor(platformTransferService: PlatformTransferService) {
    this.platformTransferService = platformTransferService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    source: PlatformSpendSource | null,
    amountCredits: bigint,
    password: string,
  ): Promise<IdentityCreateResult> => {
    return this.platformTransferService.createIdentityFromAddresses(walletId, source, amountCredits, password)
  }
}
