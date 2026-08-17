import { IpcMainInvokeEvent } from 'electron/utility'
import {ShieldedService} from '../../services/platform/ShieldedService'
import {ShieldedSyncState} from '../../types/Shielded'
export class StartShieldedSyncHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password: string): Promise<ShieldedSyncState> => {
    return this.shieldedService.startSync(walletId, password)
  }
}
