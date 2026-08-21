import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'

export class SetWalletLabel {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, label: string | null): Promise<void> => {
    return this.walletService.setWalletLabel(walletId, label)
  }
}
