import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/WalletSyncService'

export class ResetWalletSyncHandler {
  constructor(private readonly walletSyncService: WalletSyncService) {}

  handle = async (_event: IpcMainInvokeEvent, network: 'mainnet' | 'testnet'): Promise<void> => {
    await this.walletSyncService.resetSync(network)
  }
}