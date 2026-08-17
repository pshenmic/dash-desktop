import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/core/WalletService'

export class GetIdentityBalance {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, identityId: string): Promise<bigint> => {
    return this.walletService.getIdentityBalance(identityId)
  }
}
