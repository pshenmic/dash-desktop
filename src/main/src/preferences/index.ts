import fs from "fs/promises";
import {z} from 'zod'
import {GeneralPreferences, GeneralPreferencesJSON, GeneralPreferencesSchema} from "./general";
import {NetworkPreferences, NetworkPreferencesSchema} from "./network";

export const PreferencesSchema = z.object({
  general: GeneralPreferencesSchema,
  network: NetworkPreferencesSchema,
})

export type PreferencesJSON = z.infer<typeof PreferencesSchema> & { version: number }

export class Preferences {
  static readonly CURRENT_VERSION = 8

  // =====================================================
  // ANY CHANGES IN PREFERENCES REQUIRE BUMP VERSION ABOVE
  // =====================================================
  general!: GeneralPreferences

  network!: NetworkPreferences

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

    // Needed for app updates that change preferences fields.
    if (preferences.version !== (rawConfig.version ?? 0)) {
      console.log(`Preferences migrated from v${rawConfig.version ?? 0} to v${preferences.version}`)
      await fs.writeFile(path, JSON.stringify(preferences))
    }

    return preferences
  }

  // Missing fields fall back to defaults, so a prefs.json written by an older
  // app version migrates without special-casing each added field.
  private static migrate(raw: Record<string, unknown>): Preferences {
    const defaults = Preferences.default()
    const rawGeneral = (raw.general ?? {}) as Partial<GeneralPreferencesJSON>

    const instance = new Preferences()
    instance.version = Preferences.CURRENT_VERSION
    instance.general = new GeneralPreferences(
      rawGeneral.language ?? defaults.general.language,
      rawGeneral.currency ?? defaults.general.currency,
      rawGeneral.connectionType ?? defaults.general.connectionType,
      rawGeneral.platformFeeMultiplier ?? defaults.general.platformFeeMultiplier,
      rawGeneral.coreFeeMultiplier ?? defaults.general.coreFeeMultiplier,
    )

    // Hand-edited far more often than the rest of the file, so a malformed
    // section falls back to dynamic defaults instead of wedging startup.
    const rawNetwork = NetworkPreferencesSchema.safeParse(raw.network)
    if (raw.network != null && !rawNetwork.success) {
      console.error('Invalid network preferences, ignoring:', rawNetwork.error.issues.map(i => i.message).join(', '))
    }
    instance.network = rawNetwork.success
      ? NetworkPreferences.fromObject(rawNetwork.data)
      : defaults.network

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
      network: this.network.toJSON(),
    }
  }

  /**
   * Update preferences instance with passed values and save on disk.
   * @param value
   */
  async apply(value: unknown): Promise<void> {
    const parsed = PreferencesSchema.safeParse(value)

    // A ZodError crossing IPC arrives as its class name only, so the issues are
    // flattened into the message here.
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map(issue => issue.message).join(', '))
    }

    this.general = GeneralPreferences.fromObject(parsed.data.general)
    this.network = NetworkPreferences.fromObject(parsed.data.network)

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
    instance.network = NetworkPreferences.default()

    return instance
  }

  // Same fallback as the on-disk path, so callers can pass partial shapes.
  static fromObject(value: unknown): Preferences {
    return Preferences.migrate((value ?? {}) as Record<string, unknown>)
  }
}
