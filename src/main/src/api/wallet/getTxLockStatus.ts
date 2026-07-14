import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { TxLockStatus } from '../../types/TxLockStatus'

export class GetTxLockStatusHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    txid: string,
  ): Promise<TxLockStatus> => {
    return this.walletService.getTxLockStatus(walletId, txid)
  }
}
