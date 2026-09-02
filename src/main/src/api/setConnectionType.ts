import {IpcMainInvokeEvent} from 'electron/utility'
import {ConnectionType} from "../preferences/general";
import {ApplicationService} from "../services/app/ApplicationService";
import {WalletService} from "../services/wallet/WalletService";
import {CoreDiscoveryService} from "../services/core/CoreDiscoveryService";
import {Logger} from '../utils/logger'

const log = new Logger('discovery')

export class SetConnectionTypeHandler {
  private applicationService: ApplicationService
  private walletService: WalletService
  private discovery: CoreDiscoveryService

  constructor(applicationService: ApplicationService, walletService: WalletService, discovery: CoreDiscoveryService) {
    this.applicationService = applicationService
    this.walletService = walletService
    this.discovery = discovery
  }

  handle = async (_event: IpcMainInvokeEvent, connectionType: ConnectionType): Promise<void> => {
    const preferences = this.applicationService.preferences
    const previous = preferences.general.connectionType

    await preferences.apply({
      ...preferences,
      general: {
        ...preferences.general,
        connectionType,
      }
    })

    // The new mode has its own answer to "is this address used" — an SPV store
    // that never finished syncing hides usage Dashscan can see — so re-run
    // discovery now rather than waiting for the periodic tick.
    if (previous !== connectionType) {
      const selected = await this.walletService.getSelectedWallet()
      if (selected != null) {
        this.discovery.rediscoverCoreAddresses(selected.walletId).catch(err =>
          log.error('connection-type switch address discovery failed:', err))
      }
    }
  }
}
