import {z} from 'zod'
import {SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES} from '../constants/app'
import {
  DEFAULT_CORE_FEE_MULTIPLIER,
  DEFAULT_PLATFORM_FEE_MULTIPLIER,
  MAX_FEE_MULTIPLIER,
  MIN_FEE_MULTIPLIER,
} from '../constants/credits'

export const ConnectionTypeSchema = z.enum(['p2p', 'rpc'])
export type ConnectionType = z.infer<typeof ConnectionTypeSchema>

// z.number() already rejects NaN and the infinities; multipleOf(1) keeps the
// value whole and the range is what the wallet can honour.
const FeeMultiplierSchema = z
  .number()
  .min(MIN_FEE_MULTIPLIER)
  .max(MAX_FEE_MULTIPLIER)
  .multipleOf(1)

export const GeneralPreferencesSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  currency: z.enum(SUPPORTED_CURRENCIES),
  connectionType: ConnectionTypeSchema,
  platformFeeMultiplier: FeeMultiplierSchema,
  coreFeeMultiplier: FeeMultiplierSchema,
})

export type GeneralPreferencesJSON = z.infer<typeof GeneralPreferencesSchema>

export class GeneralPreferences {
  language: string
  currency: string
  connectionType: ConnectionType
  platformFeeMultiplier: number
  coreFeeMultiplier: number

  constructor(
    language: string,
    currency: string,
    connectionType: ConnectionType,
    platformFeeMultiplier: number,
    coreFeeMultiplier: number,
  ) {
    this.language = language
    this.currency = currency
    this.connectionType = connectionType
    this.platformFeeMultiplier = platformFeeMultiplier
    this.coreFeeMultiplier = coreFeeMultiplier
  }

  toJSON(): GeneralPreferencesJSON {
    return {
      language: this.language,
      currency: this.currency,
      connectionType: this.connectionType,
      platformFeeMultiplier: this.platformFeeMultiplier,
      coreFeeMultiplier: this.coreFeeMultiplier,
    }
  }

  static fromObject(value: unknown): GeneralPreferences {
    const parsed = GeneralPreferencesSchema.parse(value)
    return new GeneralPreferences(
      parsed.language,
      parsed.currency,
      parsed.connectionType,
      parsed.platformFeeMultiplier,
      parsed.coreFeeMultiplier,
    )
  }

  static default(): GeneralPreferences {
    return new GeneralPreferences('en', 'usd', 'rpc', DEFAULT_PLATFORM_FEE_MULTIPLIER, DEFAULT_CORE_FEE_MULTIPLIER)
  }
}
