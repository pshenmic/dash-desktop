import { IpcMainInvokeEvent } from 'electron/utility'
import { CoreLockService } from '../../services/CoreLockService'
import { TxLockStatus } from '../../types/TxLockStatus'

export class GetTxLockStatusHandler {
  private coreLockService: CoreLockService

  constructor(coreLockService: CoreLockService) {
    this.coreLockService = coreLockService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    txid: string,
  ): Promise<TxLockStatus> => {
    return this.coreLockService.getTxLockStatus(walletId, txid)
  }
}
