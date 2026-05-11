import {z} from 'zod'
import {SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES} from "../constants";

export const WalletInfoProviderSchema = z.enum(['p2p', 'rpc'])
export type WalletInfoProvider = z.infer<typeof WalletInfoProviderSchema>

export const GeneralPreferencesSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  currency: z.enum(SUPPORTED_CURRENCIES),
  walletInfoProvider: WalletInfoProviderSchema,
})

export type GeneralPreferencesJSON = z.infer<typeof GeneralPreferencesSchema>

export class GeneralPreferences {
  language: string
  currency: string
  walletInfoProvider: WalletInfoProvider

  constructor(language: string, currency: string, walletInfoProvider: WalletInfoProvider) {
    this.language = language
    this.currency = currency
    this.walletInfoProvider = walletInfoProvider
  }

  toJSON(): GeneralPreferencesJSON {
    return {
      language: this.language,
      currency: this.currency,
      walletInfoProvider: this.walletInfoProvider,
    }
  }

  static fromObject(value: unknown): GeneralPreferences {
    const {language, currency, walletInfoProvider} = GeneralPreferencesSchema.parse(value)
    return new GeneralPreferences(language, currency, walletInfoProvider)
  }

  static default(): GeneralPreferences {
    return new GeneralPreferences('en', 'usd', 'rpc')
  }
}