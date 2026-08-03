import { IpcMainInvokeEvent } from 'electron/utility'
import {ShieldedService} from '../../services/ShieldedService'
import {ShieldedSpendState} from '../../types/Shielded'
export class StartShieldedTransferHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, recipient: string, amountCredits: string, password: string, noteIndexes?: number[]): Promise<ShieldedSpendState> => {
    return this.shieldedService.startTransfer(walletId, password, recipient, BigInt(amountCredits), noteIndexes)
  }
}
