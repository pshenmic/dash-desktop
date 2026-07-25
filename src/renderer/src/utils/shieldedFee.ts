// Mirrors compute_minimum_shielded_fee in rs-dpp (pshenmic/platform@1ba1ca5):
// consensus pins a pool-paid spend's value_balance to exactly this minimum, so
// note selection must reserve it. num_actions = max(spends, 2). Keep in sync
// with src/main/src/utils/shieldedFee.ts (pinned by tests/unit/shieldedFee.test.ts).
export const SHIELDED_PROOF_VERIFICATION_FEE_CREDITS = 100_000_000n
export const SHIELDED_PER_ACTION_PROCESSING_FEE_CREDITS = 22_000_000n
export const SHIELDED_STORAGE_BYTES_PER_ACTION = 344n
export const SHIELDED_UNSHIELD_ADDRESS_STORAGE_BYTES = 222n
export const SHIELDED_WITHDRAWAL_DOCUMENT_STORAGE_BYTES = 4_100n
export const SHIELDED_STORAGE_CREDIT_PER_BYTE = 27_400n
export const MIN_BUNDLE_ACTIONS = 2

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
