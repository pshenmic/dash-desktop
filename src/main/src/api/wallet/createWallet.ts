import { IpcMainInvokeEvent } from 'electron/utility'
import { Network } from '../../types'
import { WalletService } from '../../services/WalletService'
import { ShieldedService } from '../../services/ShieldedService'

export class CreateWalletHandler {
  private walletService: WalletService
  private shieldedService: ShieldedService

  constructor(walletService: WalletService, shieldedService: ShieldedService) {
    this.walletService = walletService
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, seedphrase: string, network: Network, password: string): Promise<string> => {
    const walletId = await this.walletService.createWallet(seedphrase, network, password)
    // Derives and persists the shielded address list for the new wallet.
    await this.shieldedService.getAddresses(walletId, password)
    return walletId
  }
}