import {
  MIN_BUNDLE_ACTIONS,
  SHIELDED_PER_ACTION_PROCESSING_FEE_CREDITS,
  SHIELDED_PROOF_VERIFICATION_FEE_CREDITS,
  SHIELDED_STORAGE_BYTES_PER_ACTION,
  SHIELDED_STORAGE_CREDIT_PER_BYTE,
  SHIELDED_UNSHIELD_ADDRESS_STORAGE_BYTES,
  SHIELDED_WITHDRAWAL_DOCUMENT_STORAGE_BYTES,
} from '../constants'

export function minimumShieldedFeeCredits(numSpends: number): bigint {
  const actions = BigInt(Math.max(numSpends, MIN_BUNDLE_ACTIONS))
  const perAction = SHIELDED_PER_ACTION_PROCESSING_FEE_CREDITS
    + SHIELDED_STORAGE_BYTES_PER_ACTION * SHIELDED_STORAGE_CREDIT_PER_BYTE
  return SHIELDED_PROOF_VERIFICATION_FEE_CREDITS + actions * perAction
}

export function unshieldFeeCredits(numSpends: number): bigint {
  return minimumShieldedFeeCredits(numSpends)
    + SHIELDED_UNSHIELD_ADDRESS_STORAGE_BYTES * SHIELDED_STORAGE_CREDIT_PER_BYTE
}

export function shieldedWithdrawalFeeCredits(numSpends: number): bigint {
  return minimumShieldedFeeCredits(numSpends)
    + SHIELDED_WITHDRAWAL_DOCUMENT_STORAGE_BYTES * SHIELDED_STORAGE_CREDIT_PER_BYTE
}
