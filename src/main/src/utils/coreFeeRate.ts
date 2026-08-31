import {CORE_FEE_PER_BYTE, CORE_TRANSFER_FEE_DUFFS} from '../constants/chain'

// Consensus rejects a withdrawal whose coreFeePerByte is not a non-zero
// Fibonacci number, so a multiplied rate has to be snapped onto the sequence.
export function coreFeePerByte(multiplier: number): number {
  const target = CORE_FEE_PER_BYTE * multiplier

  let rate = 1
  let next = 1
  while (rate < target) {
    const sum = rate + next
    rate = next
    next = sum
  }

  return rate
}

// What an L1 transaction pays, at the user's multiplier. Written once so the
// fee a send charges and the fee its quote shows cannot drift.
export function coreFeeDuffs(multiplier: number): bigint {
  return CORE_TRANSFER_FEE_DUFFS * BigInt(multiplier)
}
