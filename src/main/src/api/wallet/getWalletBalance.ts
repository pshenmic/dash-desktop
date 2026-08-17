import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/core/WalletService'
import {WalletBalance} from "../../types/WalletBalance";

export class GetWalletBalance {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<WalletBalance> => {
    return this.walletService.getWalletBalance(walletId)
  }
}
