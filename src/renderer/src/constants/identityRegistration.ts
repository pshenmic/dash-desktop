import { AssetLockFundingKind } from '../enums/AssetLockFundingKind'

export const IDENTITY_REGISTRATION_MIN_DUFFS = 10_000_000n

export const IDENTITY_REGISTRATION_DEFAULT_AMOUNT = '0.1'

export const NEW_IDENTITY_LABEL = 'New identity'

export const IN_PROGRESS_FUNDING_LABELS: Record<Exclude<AssetLockFundingKind, AssetLockFundingKind.Identity>, string> = {
  [AssetLockFundingKind.Address]: 'Platform address funding',
  [AssetLockFundingKind.Shielded]: 'Shielding',
  [AssetLockFundingKind.IdentityTopUp]: 'Identity top-up',
}
