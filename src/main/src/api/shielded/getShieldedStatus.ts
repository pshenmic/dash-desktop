import { IpcMainInvokeEvent } from 'electron/utility'
import {ShieldedService} from '../../services/ShieldedService'
import {ShieldedStatus} from '../../types/Shielded'
export class GetShieldedStatusHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<ShieldedStatus> => {
    return this.shieldedService.getStatus()
  }
}
