import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedNotesInfo, ShieldedService } from '../../services/ShieldedService'

export class GetShieldedNotesInfoHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<ShieldedNotesInfo> => {
    return this.shieldedService.getNotesInfo(walletId)
  }
}
