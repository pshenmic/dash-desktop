import { describe, it, expect } from 'vitest'
import {GeneralPreferencesSchema} from '../../src/main/src/preferences/general'
import {MAX_FEE_MULTIPLIER} from '../../src/main/src/constants/credits'

function accepts(multiplier: number): boolean {
  return GeneralPreferencesSchema.safeParse({
    language: 'en',
    currency: 'usd',
    connectionType: 'rpc',
    platformFeeMultiplier: multiplier,
    coreFeeMultiplier: multiplier,
  }).success
}

describe('the fee multiplier schema', () => {
  it('accepts whole multipliers in range', () => {
    for (const multiplier of [1, 2, 3, MAX_FEE_MULTIPLIER]) {
      expect(accepts(multiplier)).toBe(true)
    }
  })

  it('rejects anything that is not a real number', () => {
    for (const multiplier of [NaN, Infinity, -Infinity]) {
      expect(accepts(multiplier)).toBe(false)
    }
  })

  it('rejects values outside the range the wallet can honour', () => {
    expect(accepts(0)).toBe(false)
    expect(accepts(-1)).toBe(false)
    expect(accepts(MAX_FEE_MULTIPLIER + 1)).toBe(false)
  })

  // Fees are bigint credits, so a fraction would have to round somewhere the
  // user cannot see.
  it('rejects fractional multipliers', () => {
    expect(accepts(1.5)).toBe(false)
    expect(accepts(1.01)).toBe(false)
  })
})
