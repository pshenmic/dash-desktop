import { IpcMainInvokeEvent } from 'electron/utility'
import {Preferences} from "../preferences";
import {ApplicationService} from "../services/app/ApplicationService";

export class ResetPreferencesHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<void> => {
    await this.applicationService.preferences.apply(Preferences.default().toJSON())
  }
}
