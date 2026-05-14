import { IpcMainInvokeEvent } from 'electron/utility'
import {Preferences} from "../preferences";
import {QueryStatus} from "../types/QueryStatus";
import {ZodError} from "zod";

export class SetLanguageHandler {
  private preferences: Preferences

  constructor(preferences: Preferences) {
    this.preferences = preferences
  }

  handle = async (_event: IpcMainInvokeEvent, language: string): Promise<QueryStatus> => {
    try {
      await this.preferences.apply({
        ...this.preferences,
        general: {
          ...this.preferences.general,
          language,
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
