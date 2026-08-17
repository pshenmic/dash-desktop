import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/core/WalletService'

export class ExportMnemonicHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password: string): Promise<string> => {
    return this.walletService.exportMnemonic(walletId, password)
  }
}
