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
  aliasRegister: 1,
  contactRequest: 1,
}

// FEE_VERSION3's 27,000 storage plus 400 processing credits for every byte a
// write adds to GroveDB, which is nearly all a document transition is charged.
export const STORED_BYTE_CREDITS = 27_400n
// Tree depth moves a write's cost by about 1%, which a measured overhead cannot see.
export const DOCUMENT_FEE_MARGIN_PERCENT = 5n
// An identity's first write to a contract stores its contract nonce.
export const CONTRACT_NONCE_BYTES = 324n

// What a DPNS write adds beyond its document and index values: GroveDB nodes,
// links and references. Measured on testnet at protocol 14.
export const DPNS_PREORDER_BYTES = 695n
export const DPNS_DOMAIN_BYTES = 944n
export const DPNS_CONTESTED_DOMAIN_BYTES = 2_750n
// A domain whose records.identity has none yet opens that value's index subtree.
export const DPNS_IDENTITY_SUBTREE_BYTES = 283n

// The same for a DashPay contactRequest, the larger of two testnet measurements.
export const DASHPAY_CONTACT_REQUEST_BYTES = 2_860n
// What adding one identity key stores, measured on testnet at protocol 14.
export const IDENTITY_KEY_BYTES = 452n

export const IDENTITY_TRANSFER_MIN_FEE_CREDITS = 200_000_000n

// Consensus charges it for processing the L1 lock, on top of the transition it
// funds. Duffs in the protocol, credits here.
export const ASSET_LOCK_BASE_COST_CREDITS = 50_000_000n

export const SHIELD_FUNDING_DUMMY_OUTPUTS = 1

// Consensus prices the bundle by action count, so the quote and the builder
// both read it here.
export const SHIELD_FUNDING_ACTIONS = Math.max(1 + SHIELD_FUNDING_DUMMY_OUTPUTS, MIN_BUNDLE_ACTIONS)
