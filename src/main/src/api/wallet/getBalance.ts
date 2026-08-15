import { IpcMainInvokeEvent } from 'electron/utility'
import { Network } from '../../types/Network'
import { WalletService } from '../../services/WalletService'

export class GetBalance {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, address: string | string[], network: Network): Promise<bigint> => {
    return this.walletService.getBalance(address, network)
  }
}
