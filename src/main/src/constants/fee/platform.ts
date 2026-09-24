import type {TransitionFeeOperation} from '../../../platform/types/messages'
import {MIN_BUNDLE_ACTIONS} from '../credits'

// Consensus checks balances against its worst-case fee estimate, not the fee it
// charges; each covers that estimate as measured on Drive 4.1.0.
export const DEFAULT_PLATFORM_FEE_MULTIPLIER: Record<TransitionFeeOperation, number> = {
  identityWithdrawal: 1,
  addressWithdrawal: 1,
  identityTopUpL1: 1,
  assetLockFunding: 1,
  assetLockShield: 1,
  shield: 2,
  identityToAddress: 3,
  addressFundsTransfer: 8,
  identityRegister: 2,
  identityTopUp: 14,
  identityCreate: 10,
  identityToIdentity: 70,
}

export const IDENTITY_TRANSFER_MIN_FEE_CREDITS = 200_000_000n

// Consensus charges it for processing the L1 lock, on top of the transition it
// funds. Duffs in the protocol, credits here.
export const ASSET_LOCK_BASE_COST_CREDITS = 50_000_000n

export const SHIELD_FUNDING_DUMMY_OUTPUTS = 1

// Consensus prices the bundle by action count, so the quote and the builder
// both read it here.
export const SHIELD_FUNDING_ACTIONS = Math.max(1 + SHIELD_FUNDING_DUMMY_OUTPUTS, MIN_BUNDLE_ACTIONS)
