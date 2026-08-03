import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/WalletSyncService'
import {QueryStatus} from '../../types/QueryStatus'

export class SetUtxoLabelHandler {
  private walletSyncService: WalletSyncService

  constructor(walletSyncService: WalletSyncService) {
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, txid: string, vout: number, label: string | null): Promise<QueryStatus> => {
    return this.walletSyncService.setUtxoLabel(walletId, txid, vout, label)
  }
}
