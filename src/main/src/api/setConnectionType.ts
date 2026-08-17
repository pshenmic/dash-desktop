import {IpcMainInvokeEvent} from 'electron/utility'
import {QueryStatus} from "../types/QueryStatus";
import {ZodError} from "zod";
import {ConnectionType} from "../preferences/general";
import {ApplicationService} from "../services/ApplicationService";
import {WalletService} from "../services/WalletService";
import {CoreDiscoveryService} from "../services/CoreDiscoveryService";

export class SetConnectionTypeHandler {
  private applicationService: ApplicationService
  private walletService: WalletService
  private discovery: CoreDiscoveryService

  constructor(applicationService: ApplicationService, walletService: WalletService, discovery: CoreDiscoveryService) {
    this.applicationService = applicationService
    this.walletService = walletService
    this.discovery = discovery
  }

  handle = async (_event: IpcMainInvokeEvent, connectionType: ConnectionType): Promise<QueryStatus> => {
    try {
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
            console.error('[discovery] connection-type switch address discovery failed:', err))
        }
      }

      return {success: true, errorMessage: null}
    } catch (err) {
      let message: string = (err as Error).message

      if (err instanceof ZodError) {
        message = err.issues.map(issue => issue.message).join(', ')
      }
      return {success: false, errorMessage: message}
    }
  }
}
