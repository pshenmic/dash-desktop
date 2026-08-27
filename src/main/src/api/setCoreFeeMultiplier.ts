import { IpcMainInvokeEvent } from 'electron/utility'
import {ApplicationService} from "../services/app/ApplicationService";

export class SetCoreFeeMultiplierHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (_event: IpcMainInvokeEvent, coreFeeMultiplier: number): Promise<void> => {
    const preferences = this.applicationService.preferences

    await preferences.apply({
      ...preferences,
      general: {
        ...preferences.general,
        coreFeeMultiplier,
      }
    })
  }
}
