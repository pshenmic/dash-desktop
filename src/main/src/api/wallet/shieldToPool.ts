import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { ShieldResult } from '../../types/ShieldResult'

export class ShieldToPoolHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string,
    amountCredits: string,
    password: string,
  ): Promise<ShieldResult> => {
    return this.walletService.shieldToPool(walletId, fromAddress, BigInt(amountCredits), password)
  }
}
