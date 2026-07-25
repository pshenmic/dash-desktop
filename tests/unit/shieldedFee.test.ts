import { describe, it, expect } from 'vitest'
import * as mainFee from '../../src/main/src/utils/shieldedFee'
import * as rendererFee from '../../src/renderer/src/utils/shieldedFee'
import * as mainSelection from '../../src/main/src/utils/shieldedNoteSelection'
import * as rendererSelection from '../../src/renderer/src/utils/shieldedNoteSelection'

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

describe('renderer mirror stays in sync with main', () => {
  it('produces identical fees for every spend count', () => {
    for (let count = 0; count <= 8; count++) {
      expect(rendererFee.minimumShieldedFeeCredits(count)).toBe(mainFee.minimumShieldedFeeCredits(count))
      expect(rendererFee.unshieldFeeCredits(count)).toBe(mainFee.unshieldFeeCredits(count))
      expect(rendererFee.shieldedWithdrawalFeeCredits(count)).toBe(mainFee.shieldedWithdrawalFeeCredits(count))
    }
  })

  it('selects the same notes and fee for the same inputs', () => {
    const notes = [
      { index: 0, value: 9_000_000_000n },
      { index: 1, value: 700_000_000n },
      { index: 2, value: 250_000_000n },
      { index: 3, value: 40_000_000n },
    ]
    for (const amount of [1n, 500_000n, 8_000_000_000n, 9_400_000_000n, 9_600_000_000n]) {
      const main = mainSelection.selectSpendNotes(notes, amount, 6, mainFee.minimumShieldedFeeCredits)
      const renderer = rendererSelection.selectSpendNotes(notes, amount, 6, rendererFee.minimumShieldedFeeCredits)
      expect(renderer).toEqual(main)
    }
    expect(rendererSelection.maxSpendableCredits(notes, 6, rendererFee.minimumShieldedFeeCredits))
      .toBe(mainSelection.maxSpendableCredits(notes, 6, mainFee.minimumShieldedFeeCredits))
  })
})
