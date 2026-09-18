import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import {WalletHistory} from "../../types/WalletHistory";

export class GetTransactionsHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<WalletHistory> => {
    return this.walletService.getTransactions(walletId)
  }
}
