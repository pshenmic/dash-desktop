import {z} from 'zod'
import {SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES} from "../constants";

export const GeneralPreferencesSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  currency: z.enum(SUPPORTED_CURRENCIES),
})

export type GeneralPreferencesJSON = z.infer<typeof GeneralPreferencesSchema>

export class GeneralPreferences {
  language: string
  currency: string

  constructor(language: string, currency: string) {
    this.language = language
    this.currency = currency
  }

  toJSON(): GeneralPreferencesJSON {
    return {
      language: this.language,
      currency: this.currency,
    }
  }

  static fromObject(value: unknown): GeneralPreferences {
    const {language, currency} = GeneralPreferencesSchema.parse(value)
    return new GeneralPreferences(language, currency)
  }

  static default(): GeneralPreferences {
    return new GeneralPreferences('en', 'usd')
  }
}
