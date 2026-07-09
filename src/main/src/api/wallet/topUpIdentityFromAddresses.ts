import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class TopUpIdentityFromAddressesHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identityId: string,
    fromAddress: string | null,
    amountCredits: string,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.walletService.topUpIdentityFromAddresses(walletId, identityId, fromAddress, BigInt(amountCredits), password)
  }
}
