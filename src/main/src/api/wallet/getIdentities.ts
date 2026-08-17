import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/core/WalletService'
import { IdentityInfo } from '../../types/Identity'

export class GetIdentitiesHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<IdentityInfo[]> => {
    return this.walletService.getIdentities(walletId)
  }
}
