import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/WalletSyncService'
import {BroadcastResult} from '../../../p2p/types/broadcast'

export class BroadcastTransactionHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, txHex: string): Promise<BroadcastResult> => {
    return this.walletSyncService.broadcastTransaction(txHex)
  }
}