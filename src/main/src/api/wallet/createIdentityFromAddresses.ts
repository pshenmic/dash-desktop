import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { IdentityCreateResult } from '../../types/IdentityCreateResult'

export class CreateIdentityFromAddressesHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    fromAddress: string | null,
    amountCredits: string,
    password: string,
  ): Promise<IdentityCreateResult> => {
    return this.walletService.createIdentityFromAddresses(walletId, fromAddress, BigInt(amountCredits), password)
  }
}
