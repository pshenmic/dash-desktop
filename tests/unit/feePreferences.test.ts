import { describe, it, expect } from 'vitest'
import {Preferences} from '../../src/main/src/preferences'
import {GeneralPreferences, GeneralPreferencesSchema} from '../../src/main/src/preferences/general'
import {MAX_FEE_MULTIPLIER, TRANSITION_FEE_OPERATIONS} from '../../src/main/src/constants/credits'
import {DEFAULT_PLATFORM_FEE_MULTIPLIER} from '../../src/main/src/constants/fee/platform'
import {TransitionFeeOperation} from '../../src/main/platform/types/messages'

const everyOperationAt = (multiplier: number): Record<string, number> =>
  Object.fromEntries(TRANSITION_FEE_OPERATIONS.map(operation => [operation, multiplier]))

function parseWith(platformFeeMultiplier: unknown): ReturnType<typeof GeneralPreferencesSchema.safeParse> {
  return GeneralPreferencesSchema.safeParse({
    language: 'en',
    currency: 'usd',
    connectionType: 'rpc',
    platformFeeMultiplier,
    coreFeeMultiplier: 1,
    logLevel: 'info',
  })
}

// Both fees read the same value schema, so a bound is checked through both.
function accepts(multiplier: number): boolean {
  return GeneralPreferencesSchema.safeParse({
    language: 'en',
    currency: 'usd',
    connectionType: 'rpc',
    platformFeeMultiplier: everyOperationAt(multiplier),
    coreFeeMultiplier: multiplier,
    logLevel: 'info',
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

describe('the per-operation fee multipliers', () => {
  // An operation missing from the tuple could never be set: the schema would
  // refuse its name and nothing else would notice it had been left out.
  it('can be set for every operation the worker prices', () => {
    const priced: Record<TransitionFeeOperation, true> = {
      shield: true,
      identityToAddress: true,
      identityToIdentity: true,
      identityWithdrawal: true,
      assetLockFunding: true,
      assetLockShield: true,
      identityRegister: true,
      identityTopUpL1: true,
      addressFundsTransfer: true,
      addressWithdrawal: true,
      identityCreate: true,
      identityTopUp: true,
    }
    expect([...TRANSITION_FEE_OPERATIONS].sort()).toEqual(Object.keys(priced).sort())
  })

  // Nothing falls back to, so an operation left out has no multiplier at all.
  it('refuses a set that leaves an operation out', () => {
    expect(parseWith({}).success).toBe(false)
    expect(parseWith({identityWithdrawal: 1}).success).toBe(false)
  })

  // Priced elsewhere, so setting one here would read as a fee that never applies.
  it('refuses an operation the multiplier cannot reach', () => {
    expect(parseWith({...everyOperationAt(6), coreSend: 1}).success).toBe(false)
    expect(parseWith({...everyOperationAt(6), shieldedTransfer: 1}).success).toBe(false)
    expect(parseWith({...everyOperationAt(6), notAnOperation: 1}).success).toBe(false)
  })

  it('holds each operation to the range the Core multiplier is held to', () => {
    expect(parseWith({...everyOperationAt(6), identityWithdrawal: 0}).success).toBe(false)
    expect(parseWith({...everyOperationAt(6), identityWithdrawal: 1.5}).success).toBe(false)
    expect(parseWith({...everyOperationAt(6), identityWithdrawal: MAX_FEE_MULTIPLIER + 1}).success).toBe(false)
  })

  it('falls back to what ships when a prefs file carries none', () => {
    const parsed = parseWith(undefined)
    expect(parsed.success && parsed.data.platformFeeMultiplier).toEqual(DEFAULT_PLATFORM_FEE_MULTIPLIER)
    expect(GeneralPreferences.default().platformFeeMultiplier).toEqual(DEFAULT_PLATFORM_FEE_MULTIPLIER)
  })

  // Shipping a value the schema rejects would wedge startup on a fresh install.
  it('ships defaults the schema accepts', () => {
    expect(parseWith(DEFAULT_PLATFORM_FEE_MULTIPLIER).success).toBe(true)
  })

  // The field was one number before it was one per operation, and migrate reads
  // it without the schema, so a stale file must not reach a lookup.
  it('reads a file still carrying the old single number as carrying none', () => {
    const migrated = Preferences.fromObject({general: {platformFeeMultiplier: 10}})
    expect(migrated.general.platformFeeMultiplier).toEqual(DEFAULT_PLATFORM_FEE_MULTIPLIER)
  })
})
