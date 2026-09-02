import {IpcMainInvokeEvent} from 'electron/utility'
import {applyLogLevel} from '../logTransport'
import {LogLevel} from '../types/Log'
import {ApplicationService} from '../services/app/ApplicationService'
import {WalletSyncService} from '../services/core/WalletSyncService'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

export class SetLogLevelHandler {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly walletSyncService: WalletSyncService,
    private readonly platformWorkerService: PlatformWorkerService,
  ) {}

  handle = async (_event: IpcMainInvokeEvent, logLevel: LogLevel): Promise<void> => {
    const preferences = this.applicationService.preferences

    await preferences.apply({
      ...preferences,
      general: {
        ...preferences.general,
        logLevel,
      }
    })

    // Each utility process filters at its own end, so a suppressed line never
    // crosses the pipe in the first place.
    applyLogLevel(logLevel)
    this.walletSyncService.setLogLevel(logLevel)
    this.platformWorkerService.setLogLevel(logLevel)
  }
}
