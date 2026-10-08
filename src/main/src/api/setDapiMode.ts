import {IpcMainInvokeEvent} from 'electron/utility'
import {PeerModeSchema} from '../preferences/network'
import {ApplicationService} from '../services/app/ApplicationService'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

export class SetDapiModeHandler {
  private applicationService: ApplicationService
  private platformWorkerService: PlatformWorkerService

  constructor(applicationService: ApplicationService, platformWorkerService: PlatformWorkerService) {
    this.applicationService = applicationService
    this.platformWorkerService = platformWorkerService
  }

  handle = async (_event: IpcMainInvokeEvent, mode: unknown): Promise<void> => {
    const parsed = PeerModeSchema.safeParse(mode)
    if (!parsed.success) {
      throw new Error(`setDapiMode: expected 'dynamic' or 'static', got ${JSON.stringify(mode)}`)
    }

    const preferences = this.applicationService.preferences
    await preferences.apply({
      ...preferences,
      network: {...preferences.network, dapi: {...preferences.network.dapi, mode: parsed.data}},
    })

    this.platformWorkerService.reloadDapi()
  }
}
