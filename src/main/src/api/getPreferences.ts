import { IpcMainInvokeEvent } from 'electron/utility'
import {PreferencesJSON} from "../preferences";
import {ApplicationService} from "../services/app/ApplicationService";

export class GetPreferencesHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<PreferencesJSON> => {
    return this.applicationService.preferences.toJSON()
  }
}
