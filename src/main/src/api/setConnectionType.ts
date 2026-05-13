import {IpcMainInvokeEvent} from 'electron/utility'
import {QueryStatus} from "../types/QueryStatus";
import {ZodError} from "zod";
import {ConnectionType} from "../preferences/general";
import {ApplicationService} from "../services/ApplicationService";

export class SetConnectionTypeHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (_event: IpcMainInvokeEvent, connectionType: ConnectionType): Promise<QueryStatus> => {
    try {
      const preferences = this.applicationService.preferences
      await preferences.apply({
        ...preferences,
        general: {
          ...preferences.general,
          connectionType,
        }
      })

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
