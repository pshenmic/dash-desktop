import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import { CoreDiscoveryService } from '../../services/core/CoreDiscoveryService'
import {Logger} from '../../utils/logger'

const log = new Logger('discovery')

export class SelectWallet {
  private walletService: WalletService
  private discovery: CoreDiscoveryService

  constructor(walletService: WalletService, discovery: CoreDiscoveryService) {
    this.walletService = walletService
    this.discovery = discovery
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<void> => {
    await this.walletService.setSelectedWallet(walletId)

    this.discovery.discoverCoreAddresses(walletId).catch(err =>
      log.error('address discovery on wallet select failed:', err))
  }
}
