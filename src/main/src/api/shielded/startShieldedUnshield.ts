import { IpcMainInvokeEvent } from 'electron/utility'
import {ShieldedService} from '../../services/platform/ShieldedService'
import {ShieldedSpendState} from '../../types/Shielded'
export class StartShieldedUnshieldHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, outputAddress: string, amountCredits: bigint, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> => {
    return this.shieldedService.startUnshield(walletId, password, outputAddress, amountCredits, noteIndexes)
  }
}
