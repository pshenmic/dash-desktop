import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { CoreFeeQuery, CoreFeeQuote } from '../../types/CoreFee'

export class EstimateCoreFeeHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    query: CoreFeeQuery,
  ): Promise<CoreFeeQuote> => {
    return this.walletService.estimateCoreFee(walletId, query)
  }
}
