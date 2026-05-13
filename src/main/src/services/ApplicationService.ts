import {Preferences} from '../preferences'

export class ApplicationService {
  preferences: Preferences
  private ready: boolean = false

  constructor(preferences: Preferences) {
    this.preferences = preferences
  }

  markReady(): void {
    this.ready = true
  }

  isReady(): boolean {
    return this.ready
  }
}