import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService } from '../../services/ShieldedService'

export class AddShieldedAddressHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password: string): Promise<string[]> => {
    return this.shieldedService.addAddress(walletId, password)
  }
}
