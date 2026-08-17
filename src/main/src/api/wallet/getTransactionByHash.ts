import { IpcMainInvokeEvent } from 'electron/utility'
import { Network } from '../../types/Network'
import { WalletService } from '../../services/core/WalletService'
import {Transaction} from "../../types/Transaction";

export class GetTransactionByHashHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, hash: string, network: Network): Promise<Transaction> => {
    return this.walletService.getTransactionByHash(hash, network)
  }
}
