import { describe, expect, it } from 'vitest'
import { AssetLockFundingPhase } from '../../src/renderer/src/enums/AssetLockFundingPhase'
import {
  identityRegistrationAmountError,
  identityRegistrationMaxDuffs,
  isUnfinishedAssetLockFunding,
} from '../../src/renderer/src/utils/identityRegistration'

describe('identityRegistrationAmountError', () => {
  it('accepts the 0.1 Dash minimum when the balance covers the Core fee', () => {
    expect(identityRegistrationAmountError('0.1', 10_000_000n, 10_010_000n)).toBeNull()
  })

  it('rejects an amount below the identity funding minimum', () => {
    expect(identityRegistrationAmountError('0.09999999', 9_999_999n, 100_000_000n))
      .toBe('Minimum identity funding is 0.1 Dash.')
  })

  it('rejects an amount that leaves no room for the Core fee', () => {
    expect(identityRegistrationAmountError('1', 100_000_000n, 100_000_000n))
      .toBe('Max available is 0.9999 Dash after the Core network fee.')
  })

  it('rejects malformed and over-precision amounts', () => {
    expect(identityRegistrationAmountError('1.2.3', 0n, 100_000_000n))
      .toBe('Enter a valid Dash amount with up to 8 decimal places.')
    expect(identityRegistrationAmountError('0.123456789', 12_345_678n, 100_000_000n))
      .toBe('Enter a valid Dash amount with up to 8 decimal places.')
  })

  it('keeps an empty field neutral while the UI disables advancement', () => {
    expect(identityRegistrationAmountError('', 0n, 100_000_000n)).toBeNull()
  })
})

describe('identityRegistrationMaxDuffs', () => {
  it('reserves the Core fee and never returns a negative amount', () => {
    expect(identityRegistrationMaxDuffs(100_000_000n)).toBe(99_990_000n)
    expect(identityRegistrationMaxDuffs(5_000n)).toBe(0n)
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
