import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { PlatformSendResult } from '../../types/PlatformSendResult'

export class SendPlatformTransferHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string,
    toAddress: string,
    amountCredits: string,
    password: string,
  ): Promise<PlatformSendResult> => {
    return this.walletService.sendPlatformTransfer(walletId, fromAddress, toAddress, BigInt(amountCredits), password)
  }
}
