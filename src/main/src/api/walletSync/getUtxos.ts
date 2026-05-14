import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/WalletSyncService'
import {WalletSyncUtxo} from '../../../p2p/types/walletSync'

export class GetUtxosHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<WalletSyncUtxo[]> => {
    return this.walletSyncService.getUtxos()
  }
}