import {KeyType, Purpose, SecurityLevel} from 'dash-platform-sdk/types.js'

export const CREDITS_PER_DUFF = 1_000n

export const DEFAULT_PLATFORM_FEE_MULTIPLIER = 6
export const DEFAULT_CORE_FEE_MULTIPLIER = 1
// A metered fee is already the consensus minimum, so below 1 the wallet would
// underpay its own transitions — a guaranteed rejection, not a cheaper send.
export const MIN_FEE_MULTIPLIER = 1
export const MAX_FEE_MULTIPLIER = 20

export const MIN_OUTPUT_CREDITS = 500_000n
export const MIN_INPUT_CREDITS = 100_000n
// Consensus funds a new identity from a lower floor than it accepts as an
// ordinary output.
export const MIN_IDENTITY_FUNDING_CREDITS = 200_000n
export const MAX_ADDRESS_INPUTS = 16
export const MAX_RECIPIENTS = 128
// What fits the 20 KiB max_state_transition_size, not the protocol's own
// max_shielded_transition_actions of 16: the Halo2 proof grows ~2,681 bytes per
// action, so a seventh action puts the transition over the wire limit.
export const MAX_BUNDLE_ACTIONS = 6
// The change note takes a slot of its own, and is written even at zero value.
export const MAX_SPEND_RECIPIENTS = MAX_BUNDLE_ACTIONS - 1
// One action per note spent, so the note cap is the action cap.
export const MAX_SPEND_NOTES = MAX_BUNDLE_ACTIONS
// An Orchard bundle carries at least two actions, so a single-note spend is
// still charged for two.
export const MIN_BUNDLE_ACTIONS = 2
export const MAX_FEE_STRATEGY_STEPS = 4

export const ASSET_LOCK_PAYLOAD_VERSION = 1
export const ASSET_LOCK_CREDIT_OUTPUT_INDEX = 0
export const ASSET_LOCK_DISMISSED_ERROR = 'Pending funding dismissed by user'
export const ALREADY_IN_CHAIN = 'state transition already in chain'

// Background prefetch only keeps the ciphertext cache warm — detecting incoming
// notes needs trial-decryption, so a password. The batch size is fixed: the dpp
// proof verifier requires getShieldedEncryptedNotes startIndex to be a multiple
// of SHIELDED_MAX_NOTES_PER_QUERY.
export const SHIELDED_NOTES_CHECK_INTERVAL_MS = 30_000
export const SHIELDED_NOTES_FETCH_BATCH = 8192
export const SHIELD_FUNDING_FEE_RESERVE_CREDITS = 300_000_000n

// Protocol limits IdentityCreateTransition to 6 public keys. AUTH MEDIUM is
// dropped (added later via IdentityUpdateTransition if needed); MASTER /
// CRITICAL / HIGH plus ENCRYPTION / DECRYPTION / TRANSFER cover the common path.
export const IDENTITY_KEY_DEFINITIONS = [
  {id: 0, purpose: Purpose.AUTHENTICATION, securityLevel: SecurityLevel.MASTER, keyType: KeyType.ECDSA_SECP256K1},
  {id: 1, purpose: Purpose.AUTHENTICATION, securityLevel: SecurityLevel.CRITICAL, keyType: KeyType.ECDSA_SECP256K1},
  {id: 2, purpose: Purpose.AUTHENTICATION, securityLevel: SecurityLevel.HIGH, keyType: KeyType.ECDSA_SECP256K1},
  {id: 3, purpose: Purpose.ENCRYPTION, securityLevel: SecurityLevel.MEDIUM, keyType: KeyType.ECDSA_SECP256K1},
  {id: 4, purpose: Purpose.DECRYPTION, securityLevel: SecurityLevel.MEDIUM, keyType: KeyType.ECDSA_SECP256K1},
  {id: 5, purpose: Purpose.TRANSFER, securityLevel: SecurityLevel.CRITICAL, keyType: KeyType.ECDSA_SECP256K1},
] as const
