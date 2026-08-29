import { describe, expect, it } from 'vitest'
import { AssetLockFundingPhase } from '../../src/renderer/src/enums/AssetLockFundingPhase'
import {
  identityRegistrationAmountError,
  identityRegistrationMaxDuffs,
  isUnfinishedAssetLockFunding,
} from '../../src/renderer/src/utils/identityRegistration'

const FEE = 10_000n
const MAX = 100_000_000n - FEE

describe('identityRegistrationAmountError', () => {
  it('accepts the 0.1 Dash minimum when the balance covers the Core fee', () => {
    expect(identityRegistrationAmountError('0.1', 10_000_000n, 10_000_000n)).toBeNull()
  })

  it('rejects an amount below the identity funding minimum', () => {
    expect(identityRegistrationAmountError('0.09999999', 9_999_999n, MAX))
      .toBe('Minimum identity funding is 0.1 Dash.')
  })

  it('rejects an amount that leaves no room for the fees', () => {
    expect(identityRegistrationAmountError('1', 100_000_000n, MAX))
      .toBe('Max available is 0.9999 Dash after fees.')
  })

  it('rejects malformed and over-precision amounts', () => {
    expect(identityRegistrationAmountError('1.2.3', 0n, MAX))
      .toBe('Enter a valid Dash amount with up to 8 decimal places.')
    expect(identityRegistrationAmountError('0.123456789', 12_345_678n, MAX))
      .toBe('Enter a valid Dash amount with up to 8 decimal places.')
  })

  it('keeps an empty field neutral while the UI disables advancement', () => {
    expect(identityRegistrationAmountError('', 0n, MAX)).toBeNull()
  })

  // The quote that knows the ceiling is still in flight; nothing is over a
  // ceiling nobody has drawn yet.
  it('holds its verdict while the amount is unpriced', () => {
    expect(identityRegistrationAmountError('1', 100_000_000n, null)).toBeNull()
  })
})

describe('identityRegistrationMaxDuffs', () => {
  it('reserves what the transition takes on L2 and never returns a negative amount', () => {
    expect(identityRegistrationMaxDuffs(100_000_000n, FEE)).toBe(99_990_000n)
    expect(identityRegistrationMaxDuffs(5_000n, FEE)).toBe(0n)
  })
})

describe('isUnfinishedAssetLockFunding', () => {
  it.each([
    AssetLockFundingPhase.Resumable,
    AssetLockFundingPhase.Building,
    AssetLockFundingPhase.BroadcastingL1,
    AssetLockFundingPhase.WaitingChainLock,
    AssetLockFundingPhase.BroadcastingST,
  ])('treats %s as unfinished', (phase) => {
    expect(isUnfinishedAssetLockFunding(phase)).toBe(true)
  })

  it.each([
    AssetLockFundingPhase.Idle,
    AssetLockFundingPhase.Done,
    AssetLockFundingPhase.Error,
  ])('treats %s as terminal', (phase) => {
    expect(isUnfinishedAssetLockFunding(phase)).toBe(false)
  })
})
