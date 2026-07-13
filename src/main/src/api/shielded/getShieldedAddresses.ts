import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService } from '../../services/ShieldedService'

export class GetShieldedAddressesHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password?: string): Promise<string[] | null> => {
    return this.shieldedService.getAddresses(walletId, password)
  }
}
