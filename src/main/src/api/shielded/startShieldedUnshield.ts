import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService, ShieldedSpendState } from '../../services/ShieldedService'

export class StartShieldedUnshieldHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, outputAddress: string, amountCredits: string, password: string): Promise<ShieldedSpendState> => {
    return this.shieldedService.startUnshield(walletId, password, outputAddress, BigInt(amountCredits))
  }
}
