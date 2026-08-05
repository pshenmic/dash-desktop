import {CoreFeeShape} from '../enums/CoreFeeShape'
import {RecipientType} from './CoreTransaction'

export type CoreFeeQuery =
  | {shape: CoreFeeShape.Send; amountDuffs: bigint; toAddress: string | null; fromAddress: string | null}
  | {shape: CoreFeeShape.AssetLock; amountDuffs: bigint}

export interface CoreFeeQuote {
  feeDuffs: bigint | null
  maxSendableDuffs: bigint
}

export interface CoreFeeRecipient {
  address: string
  type: RecipientType
}
