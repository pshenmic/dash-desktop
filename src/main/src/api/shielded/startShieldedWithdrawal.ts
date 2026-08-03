import { IpcMainInvokeEvent } from 'electron/utility'
import {ShieldedService} from '../../services/ShieldedService'
import {ShieldedSpendState} from '../../types/Shielded'
export class StartShieldedWithdrawalHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, coreAddress: string, amountCredits: string, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> => {
    return this.shieldedService.startWithdrawal(walletId, password, coreAddress, BigInt(amountCredits), noteIndexes)
  }
}
