import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService, ShieldedSpendState } from '../../services/ShieldedService'

export class StartShieldedTransferHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, recipient: string, amountCredits: string, password: string, noteIndex?: number): Promise<ShieldedSpendState> => {
    return this.shieldedService.startTransfer(walletId, password, recipient, BigInt(amountCredits), noteIndex != null ? [noteIndex] : undefined)
  }
}
