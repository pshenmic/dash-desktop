import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformTransferService } from '../../services/platform/PlatformTransferService'
import { IdentityCreateResult } from '../../types/IdentityCreateResult'

export class CreateIdentityFromAddressesHandler {
  private platformTransferService: PlatformTransferService

  constructor(platformTransferService: PlatformTransferService) {
    this.platformTransferService = platformTransferService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string | null,
    amountCredits: bigint,
    password: string,
  ): Promise<IdentityCreateResult> => {
    return this.platformTransferService.createIdentityFromAddresses(walletId, fromAddress, amountCredits, password)
  }
}
