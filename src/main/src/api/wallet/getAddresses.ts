import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import {GroupedAddresses} from "../../types/GroupedAddresses";

export class GetWalletAddressesHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<GroupedAddresses> => {
    return this.walletService.getAddressesByWalletId(walletId)
  }
}