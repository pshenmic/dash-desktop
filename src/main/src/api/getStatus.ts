import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../services/WalletService'
import { ApplicationService } from '../services/ApplicationService'
import { WalletSyncService } from '../services/WalletSyncService'
import { WalletSyncStatus } from '../../p2p/messages'
import {Network} from "../types";

// Aggregated app status. Wallet-sync progress is folded in here rather
// than exposed via a separate IPC so the renderer has a single poll
// surface — when other status sources land (Platform sync, etc.) they'll
// nest under here too.
//
// `walletSync` is always populated (phase === 'stopped' when no utility
// process is running) — renderer never has to special-case null.
export interface AppStatus {
  ready: boolean
  selectedWalletId: string | null
  network: Network | null
  walletSync: WalletSyncStatus
}

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

    return {
      ready: this.applicationService.isReady(),
      selectedWalletId: selected?.walletId ?? null,
      network: selected?.network ?? null,
      walletSync: this.walletSyncService.getStatus(),
    }
  }
}
