import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import {QueryStatus} from "../../types/QueryStatus";

export class DeleteWalletHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<QueryStatus> => {
    return this.walletService.deleteWallet(walletId)
  }
}
