import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class SendIdentityCreditsHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identityId: string,
    toAddress: string,
    amountCredits: string,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.walletService.sendIdentityCreditsToAddresses(
      walletId,
      identityId,
      [{address: toAddress, amountCredits: BigInt(amountCredits)}],
      password,
    )
  }
}
