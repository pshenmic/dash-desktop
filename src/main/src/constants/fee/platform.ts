import type {TransitionFeeOperation} from '../../../platform/types/messages'
import {MIN_BUNDLE_ACTIONS} from '../credits'

// Headroom over the quote only where consensus meters and the unspent fee stays
// put; shield's entry is not headroom but the reserve left unclaimed on input 0.
export const DEFAULT_PLATFORM_FEE_MULTIPLIER: Record<TransitionFeeOperation, number> = {
  identityWithdrawal: 2,
  addressWithdrawal: 2,
  identityTopUpL1: 2,
  assetLockFunding: 1,
  assetLockShield: 1,
  shield: 2,
  identityToAddress: 3,
  addressFundsTransfer: 4,
  identityRegister: 3,
  identityTopUp: 7,
  identityCreate: 10,
  identityToIdentity: 45,
}

// Consensus charges it for processing the L1 lock, on top of the transition it
// funds. Duffs in the protocol, credits here.
export const ASSET_LOCK_BASE_COST_CREDITS = 50_000_000n

export const SHIELD_FUNDING_DUMMY_OUTPUTS = 1

// Consensus prices the bundle by action count, so the quote and the builder
// both read it here.
export const SHIELD_FUNDING_ACTIONS = Math.max(1 + SHIELD_FUNDING_DUMMY_OUTPUTS, MIN_BUNDLE_ACTIONS)
