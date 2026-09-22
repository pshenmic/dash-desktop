import { IpcMainInvokeEvent } from 'electron/utility'
import {ApplicationService} from "../services/app/ApplicationService";
import {TransitionFeeOperation} from '../../platform/types/messages'

export class SetPlatformFeeMultiplierHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    operation: TransitionFeeOperation,
    multiplier: number,
  ): Promise<void> => {
    const preferences = this.applicationService.preferences
    const {general} = preferences

    await preferences.apply({
      ...preferences,
      general: {
        ...general,
        platformFeeMultiplier: {...general.platformFeeMultiplier, [operation]: multiplier},
      },
    })
  }
}
