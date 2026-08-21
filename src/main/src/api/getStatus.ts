import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../services/wallet/WalletService'
import { ApplicationService } from '../services/app/ApplicationService'
import { WalletSyncService } from '../services/core/WalletSyncService'

import {AppStatus} from '../types/AppStatus'
export class GetStatusHandler {
  private walletService: WalletService
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService

  constructor(
    walletService: WalletService,
    applicationService: ApplicationService,
    walletSyncService: WalletSyncService,
  ) {
    this.walletService = walletService
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<AppStatus> => {
    const selected = await this.walletService.getSelectedWallet()
    const connectionStatus = selected == null
      ? null
      : await this.walletService.getConnectionStatus(selected)

    return {
      ready: this.applicationService.isReady(),
      selectedWalletId: selected?.walletId ?? null,
      network: selected?.network ?? null,
      connectionStatus,
      walletSync: this.walletSyncService.getStatus(),
    }
  }
}
