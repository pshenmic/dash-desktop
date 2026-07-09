import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class WithdrawPlatformCreditsHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string | null,
    toCoreAddress: string,
    amountCredits: string,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.walletService.withdrawPlatformToCore(walletId, fromAddress, toCoreAddress, BigInt(amountCredits), password)
  }
}
