import { IpcMainInvokeEvent } from 'electron/utility'
import {ShieldedService} from '../../services/platform/ShieldedService'
import {ShieldedSpendState} from '../../types/Shielded'
export class StartShieldedWithdrawalHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, coreAddress: string, amountCredits: bigint, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> => {
    return this.shieldedService.startWithdrawal(walletId, password, coreAddress, amountCredits, noteIndexes)
  }
}
