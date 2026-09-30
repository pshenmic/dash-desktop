import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformTransferService } from '../../services/platform/PlatformTransferService'
import { PlatformSpendSource } from '../../types/PlatformTransfer'
import { ShieldResult } from '../../types/ShieldResult'

export class ShieldToPoolHandler {
  private platformTransferService: PlatformTransferService

  constructor(platformTransferService: PlatformTransferService) {
    this.platformTransferService = platformTransferService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    source: PlatformSpendSource | null,
    toAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<ShieldResult> => {
    return this.platformTransferService.shieldToPool(walletId, source, toAddress, amountCredits, password)
  }
}
