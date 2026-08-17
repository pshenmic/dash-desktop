import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/WalletService'
import { CoreDiscoveryService } from '../../services/CoreDiscoveryService'
import {QueryStatus} from "../../types/QueryStatus";

export class SelectWallet {
  private walletService: WalletService
  private discovery: CoreDiscoveryService

  constructor(walletService: WalletService, discovery: CoreDiscoveryService) {
    this.walletService = walletService
    this.discovery = discovery
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<QueryStatus> => {
    const result = await this.walletService.setSelectedWallet(walletId)
    if (result.success) {
      this.discovery.discoverCoreAddresses(walletId).catch(err =>
        console.error('[discovery] address discovery on wallet select failed:', err))
    }
    return result
  }
}
