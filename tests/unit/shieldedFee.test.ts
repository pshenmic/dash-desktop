import { describe, it, expect } from 'vitest'
import * as mainFee from '../../src/main/src/utils/shieldedFee'

describe('shielded fee formula', () => {
  it('matches the consensus minimum for a 2-action bundle', () => {
    expect(mainFee.minimumShieldedFeeCredits(2)).toBe(162_851_200n)
  })

  it('pads bundles below 2 actions up to the 2-action minimum', () => {
    expect(mainFee.minimumShieldedFeeCredits(0)).toBe(162_851_200n)
    expect(mainFee.minimumShieldedFeeCredits(1)).toBe(162_851_200n)
  })

  it('grows per action past the minimum bundle', () => {
    expect(mainFee.minimumShieldedFeeCredits(3)).toBe(194_276_800n)
    expect(mainFee.minimumShieldedFeeCredits(6)).toBe(288_553_600n)
  })

  it('adds the flat address-write component for unshield', () => {
    expect(mainFee.unshieldFeeCredits(2)).toBe(168_934_000n)
  })

  it('adds the flat withdrawal-document component for withdrawal', () => {
    expect(mainFee.shieldedWithdrawalFeeCredits(2)).toBe(275_191_200n)
  })
})
