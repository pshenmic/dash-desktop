import { IpcMainInvokeEvent } from 'electron/utility'
import {ShieldedService} from '../../services/platform/ShieldedService'
import {ShieldedSpendState} from '../../types/Shielded'
export class StartShieldedIdentityCreateHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, denominationCredits: bigint, password: string): Promise<ShieldedSpendState> => {
    return this.shieldedService.startIdentityCreate(walletId, password, denominationCredits)
  }
}
