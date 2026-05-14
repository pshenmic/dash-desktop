import fs from "fs/promises";
import {z} from 'zod'
import {GeneralPreferences, GeneralPreferencesJSON, GeneralPreferencesSchema} from "./general";

export const PreferencesSchema = z.object({
  general: GeneralPreferencesSchema,
})

export type PreferencesJSON = z.infer<typeof PreferencesSchema> & { version: number }

export class Preferences {
  static readonly CURRENT_VERSION = 1

  // =====================================================
  // ANY CHANGES IN PREFERENCES REQUIRE BUMP VERSION ABOVE
  // =====================================================
  general!: GeneralPreferences

  private path: string | null = null

  version!: number

  private constructor() {/**/}

  static async init(path?: string): Promise<Preferences> {
    if (path == null) {
      console.warn(`Preferences path not set. Using RAM`)
      return Preferences.default()
    }

    let fileExists: boolean
    try {
      // check if file exist and we can read it (permissions)
      await fs.access(path)
      fileExists = true
    } catch {
      fileExists = false
    }

    let preferences: Preferences

    if (!fileExists) {
      console.log('Preferences file not exists. Creating Preferences')
      preferences = await Preferences.createAndWrite(path)
    } else {
      preferences = await Preferences.readFromFile(path)
    }

    preferences.path = path

    return preferences
  }

  private static async readFromFile(path: string): Promise<Preferences> {
    let rawConfig: Record<string, unknown>
    try {
      const content = await fs.readFile(path, 'utf-8')
      rawConfig = JSON.parse(content)
    } catch (err) {
      // TODO: We need to throw this error to frontend
      console.error('Failed to read preferences file, backup corrupted file, recreating with defaults:', err)

      const corruptedPath = `${path}.error-${Date.now()}`
      await fs.rename(path, corruptedPath)

      return Preferences.createAndWrite(path)
    }

    const preferences = Preferences.migrate(rawConfig)

    // migration mechanism
    // needed for app updates which change preferences fields
    if (preferences.version !== (rawConfig.version ?? 0)) {
      console.log(`Preferences migrated from v${rawConfig.version ?? 0} to v${preferences.version}`)
      await fs.writeFile(path, JSON.stringify(preferences))
    }

    return preferences
  }

  private static migrate(raw: Record<string, unknown>): Preferences {
    const defaults = Preferences.default()
    const rawGeneral = (raw.general ?? {}) as Partial<GeneralPreferencesJSON>

    const instance = new Preferences()
    instance.version = Preferences.CURRENT_VERSION
    instance.general = new GeneralPreferences(
      rawGeneral.language ?? defaults.general.language,
      rawGeneral.currency ?? defaults.general.currency,
    )

    return instance
  }

  private static async createAndWrite(path: string): Promise<Preferences> {
    const preferences = Preferences.default()

    await fs.writeFile(path, JSON.stringify(preferences))

    return preferences
  }

  toJSON(): PreferencesJSON {
    return {
      version: this.version,
      general: this.general.toJSON(),
    }
  }

  /**
   * Update preferences instance with passed values and save on disk.
   * @param value
   */
  async apply(value: unknown): Promise<void> {
    const {general} = PreferencesSchema.parse(value)

    this.general = GeneralPreferences.fromObject(general)

    await this.update()
  }

  /**
   * Save preferencess to selected folder
   */
  async update(): Promise<void> {
    if (this.path != null) {
      await fs.writeFile(this.path, JSON.stringify(this))
    }
  }

  static default(): Preferences {
    const instance = new Preferences()

    instance.version = Preferences.CURRENT_VERSION
    instance.general = GeneralPreferences.default()

    return instance
  }

  static fromObject(value: unknown): Preferences {
    const {general} = PreferencesSchema.parse(value)

    const instance = new Preferences()

    instance.version = Preferences.CURRENT_VERSION
    instance.general = GeneralPreferences.fromObject(general)

    return instance
  }
}
