import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import { CoreSpendSource } from '../../types/CoinSelection'
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
    amountDuffs: bigint,
    password: string,
    source?: CoreSpendSource,
  ): Promise<SendResult> => {
    return this.walletService.sendTransaction(walletId, toAddress, amountDuffs, password, source)
  }
}
