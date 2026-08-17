import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/core/WalletService'

export class GetIdentityNonce {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, identityId: string): Promise<bigint> => {
    return this.walletService.getIdentityNonce(identityId)
  }
}
