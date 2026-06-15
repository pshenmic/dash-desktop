import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { SendResult } from '../../types/SendResult'

export class SendTransactionHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    toAddress: string,
    amountDuffs: string,
    password: string,
  ): Promise<SendResult> => {
    return this.walletService.sendTransaction(walletId, toAddress, BigInt(amountDuffs), password)
  }
}
