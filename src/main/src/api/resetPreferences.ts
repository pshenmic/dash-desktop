import { IpcMainInvokeEvent } from 'electron/utility'
import {Preferences} from "../preferences";
import {QueryStatus} from "../types/QueryStatus";
import {ZodError} from "zod";

export class ResetPreferencesHandler {
  private preferences: Preferences

  constructor(preferences: Preferences) {
    this.preferences = preferences
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<QueryStatus> => {
    try {
      const defaults = Preferences.default()
      console.log(defaults)
      await this.preferences.apply(defaults.toJSON())

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
