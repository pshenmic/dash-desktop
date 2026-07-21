import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService, ShieldedSpendState } from '../../services/ShieldedService'

export class StartShieldedWithdrawalHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, coreAddress: string, amountCredits: string, password: string, noteIndex?: number): Promise<ShieldedSpendState> => {
    return this.shieldedService.startWithdrawal(walletId, password, coreAddress, BigInt(amountCredits), noteIndex != null ? [noteIndex] : undefined)
  }
}
