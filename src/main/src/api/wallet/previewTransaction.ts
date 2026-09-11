import { IpcMainInvokeEvent } from 'electron/utility'
import { FeeService } from '../../services/wallet/FeeService'
import { PreviewParams, TransactionPreview } from '../../types/TransactionPreview'
import { FeeOperation } from '../../../platform/types/messages'

export class PreviewTransactionHandler {
  private feeService: FeeService

  constructor(feeService: FeeService) {
    this.feeService = feeService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    operation: FeeOperation,
    params: PreviewParams,
  ): Promise<TransactionPreview> => {
    return this.feeService.previewTransaction(walletId, operation, params)
  }
}
