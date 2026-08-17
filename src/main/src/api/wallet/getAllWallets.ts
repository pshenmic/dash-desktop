import { IpcMainInvokeEvent } from 'electron/utility'
import { Wallet } from '../../types/Wallet'
import { WalletService } from '../../services/core/WalletService'

export class GetAllWalletsHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<Wallet[]> => {
    return this.walletService.getAllWallets()
  }
}
