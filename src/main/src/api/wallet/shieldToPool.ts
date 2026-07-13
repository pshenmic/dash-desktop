import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/PlatformAddressService'
import { ShieldResult } from '../../types/ShieldResult'

export class ShieldToPoolHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string,
    toAddress: string,
    amountCredits: string,
    password: string,
  ): Promise<ShieldResult> => {
    return this.platformAddressService.shieldToPool(walletId, fromAddress, toAddress, BigInt(amountCredits), password)
  }
}
