import { IpcMainInvokeEvent } from 'electron/utility'
import { FeeService } from '../../services/wallet/FeeService'
import { OperationFee } from '../../types/Fee'
import { FeeOperation, FeeParams } from '../../../platform/types/messages'

export class EstimateFeeHandler {
  private feeService: FeeService

  constructor(feeService: FeeService) {
    this.feeService = feeService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    operation: FeeOperation,
    params: FeeParams,
  ): Promise<OperationFee> => {
    return this.feeService.estimateFee(walletId, operation, params)
  }
}
