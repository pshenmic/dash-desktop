import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService, ShieldedStatus } from '../../services/ShieldedService'

export class GetShieldedStatusHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<ShieldedStatus> => {
    return this.shieldedService.getStatus()
  }
}
