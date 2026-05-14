import { IpcMainInvokeEvent } from 'electron/utility'
import {Preferences, PreferencesJSON} from "../preferences";

export class GetPreferencesHandler {
  private preferences: Preferences

  constructor(preferences: Preferences) {
    this.preferences = preferences
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<PreferencesJSON> => {
    return this.preferences.toJSON()
  }
}
