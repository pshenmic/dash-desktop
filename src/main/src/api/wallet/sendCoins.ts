import {IpcMainInvokeEvent} from 'electron/utility'
import {TransactionService} from '../../services/TransactionService'

export class SendCoinsHandler {
  private transactionService: TransactionService

  constructor(transactionService: TransactionService) {
    this.transactionService = transactionService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    toAddress: string,
    amountSatoshis: string,
    password: string,
  ): Promise<string> => {
    return this.transactionService.sendCoins(walletId, toAddress, amountSatoshis, password)
  }
}
