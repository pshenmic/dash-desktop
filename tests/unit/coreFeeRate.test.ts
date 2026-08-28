import { describe, it, expect } from 'vitest'
import {coreFeePerByte} from '../../src/main/src/utils/coreFeeRate'
import {CORE_FEE_PER_BYTE} from '../../src/main/src/constants/chain'
import {MAX_FEE_MULTIPLIER, MIN_FEE_MULTIPLIER} from '../../src/main/src/constants/credits'

// Mirrors is_non_zero_fibonacci_number, the rule
// AddressCreditWithdrawalTransitionV0::validate_structure enforces.
function isNonZeroFibonacci(value: number): boolean {
  let previous = 1
  let current = 1
  while (previous < value) {
    const next = previous + current
    previous = current
    current = next
  }
  return previous === value
}

describe('coreFeePerByte', () => {
  it('leaves the base rate alone at the default multiplier', () => {
    expect(coreFeePerByte(MIN_FEE_MULTIPLIER)).toBe(CORE_FEE_PER_BYTE)
  })

  // A non-Fibonacci rate fails structure validation, so the multiplied value
  // has to land on the sequence rather than nearby.
  it('snaps a multiplied rate onto the Fibonacci sequence', () => {
    expect(coreFeePerByte(2)).toBe(2)
    expect(coreFeePerByte(3)).toBe(3)
    expect(coreFeePerByte(4)).toBe(5)
    expect(coreFeePerByte(6)).toBe(8)
    expect(coreFeePerByte(10)).toBe(13)
  })

  it('never returns a rate consensus would reject', () => {
    for (let multiplier = MIN_FEE_MULTIPLIER; multiplier <= MAX_FEE_MULTIPLIER; multiplier++) {
      const rate = coreFeePerByte(multiplier)
      expect(rate).toBeGreaterThan(0)
      expect(isNonZeroFibonacci(rate)).toBe(true)
    }
  })

  it('never returns less than the requested rate', () => {
    for (const multiplier of [1, 2, 3, 4, 7, MAX_FEE_MULTIPLIER]) {
      expect(coreFeePerByte(multiplier)).toBeGreaterThanOrEqual(CORE_FEE_PER_BYTE * multiplier)
    }
  })
})
