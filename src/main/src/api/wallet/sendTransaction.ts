import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import { CoreSpendSource } from '../../types/CoinSelection'
import { CoreRecipient } from '../../types/CoreTransaction'
import { SendResult } from '../../types/SendResult'

export class SendTransactionHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    recipients: CoreRecipient[],
    password: string,
    source?: CoreSpendSource,
  ): Promise<SendResult> => {
    return this.walletService.sendTransaction(walletId, recipients, password, source)
  }
}
