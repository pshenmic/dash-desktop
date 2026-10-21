import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import { SendResult } from '../../types/SendResult'

export class SendDashPayPaymentHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    identifier: string,
    contactId: string,
    amountDuffs: bigint,
    password: string,
  ): Promise<SendResult> => {
    return this.walletService.sendDashPayPayment(walletId, identifier, contactId, amountDuffs, password)
  }
}
