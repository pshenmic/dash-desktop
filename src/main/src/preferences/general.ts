import {z} from 'zod'
import {SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES} from "../constants";

export const ConnectionTypeSchema = z.enum(['p2p', 'rpc'])
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>

export const GeneralPreferencesSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  currency: z.enum(SUPPORTED_CURRENCIES),
  connectionType: ConnectionTypeSchema,
})

export type GeneralPreferencesJSON = z.infer<typeof GeneralPreferencesSchema>

export class GeneralPreferences {
  language: string
  currency: string
  connectionType: ConnectionType

  constructor(language: string, currency: string, connectionType: ConnectionType) {
    this.language = language
    this.currency = currency
    this.connectionType = connectionType
  }

  toJSON(): GeneralPreferencesJSON {
    return {
      language: this.language,
      currency: this.currency,
      connectionType: this.connectionType,
    }
  }

  static fromObject(value: unknown): GeneralPreferences {
    const {language, currency, connectionType} = GeneralPreferencesSchema.parse(value)
    return new GeneralPreferences(language, currency, connectionType)
  }

  static default(): GeneralPreferences {
    return new GeneralPreferences('en', 'usd', 'rpc')
  }
}
