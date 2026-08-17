import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/core/WalletService'
import {QueryStatus} from "../../types/QueryStatus";

export class SetAddressLabel {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, address: string, label: string): Promise<QueryStatus> => {
    return this.walletService.setAddressLabel(walletId, address, label)
  }
}
