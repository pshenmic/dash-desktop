import { IpcMainInvokeEvent } from 'electron/utility'
import { FeeService } from '../../services/wallet/FeeService'
import { FeeOperation, FeeParams, OperationFee } from '../../types/Fee'

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
