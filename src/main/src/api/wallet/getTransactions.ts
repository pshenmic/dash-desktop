import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import {Transaction} from "../../types/Transaction";

export class GetTransactionsHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<Transaction[]> => {
    return this.walletService.getTransactions(walletId)
  }
}
