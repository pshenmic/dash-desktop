import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import {QueryStatus} from "../../types/QueryStatus";

export class SelectWallet {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<QueryStatus> => {
    const result = await this.walletService.setSelectedWallet(walletId)
    if (result.success) {
      this.walletService.discoverCoreAddresses(walletId).catch(err =>
        console.error('[discovery] address discovery on wallet select failed:', err))
    }
    return result
  }
}
