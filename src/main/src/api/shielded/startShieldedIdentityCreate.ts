import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService, ShieldedSpendState } from '../../services/ShieldedService'

export class StartShieldedIdentityCreateHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, denominationCredits: string, password: string): Promise<ShieldedSpendState> => {
    return this.shieldedService.startIdentityCreate(walletId, password, BigInt(denominationCredits))
  }
}
