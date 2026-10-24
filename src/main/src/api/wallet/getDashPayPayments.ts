import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import { DashPayPayment } from '../../types/DashPay'

export class GetDashPayPaymentsHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, identifier: string, contactId: string): Promise<DashPayPayment[]> => {
    return this.walletService.getDashPayPayments(walletId, identifier, contactId)
  }
}
