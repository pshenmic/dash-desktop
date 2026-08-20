import { describe, it, expect } from 'vitest'
import {selectPlatformSource, identityTransferFeeCredits, identityCreateFeeCredits, topUpFeeCredits, toAddressInput} from '../../src/main/src/utils/platformTransfer'
import {PlatformSourceCandidate} from '../../src/main/src/types/PlatformTransfer'
import {MIN_OUTPUT_CREDITS} from '../../src/main/src/constants'
function candidate(platformAddress: string, balanceCredits: bigint, nonce = 0): PlatformSourceCandidate {
  return {
    platformAddress,
    index: 0,
    balanceCredits,
    nonce,
  }
}

const AMOUNT = 1_000_000n
const FEE = 6_500_000n
const REQUIRED = AMOUNT + FEE

describe('selectPlatformSource', () => {
  it('picks the largest balance that covers amount + fee', () => {
    const candidates = [
      candidate('a', REQUIRED),
      candidate('b', REQUIRED + 9_000_000n),
      candidate('c', REQUIRED + 1n),
    ]
    expect(selectPlatformSource(candidates, AMOUNT, FEE).platformAddress).toBe('b')
  })

  it('accepts a balance exactly equal to amount + fee', () => {
    expect(selectPlatformSource([candidate('a', REQUIRED)], AMOUNT, FEE).platformAddress).toBe('a')
  })

  it('throws when no address covers amount + fee', () => {
    const candidates = [candidate('a', AMOUNT), candidate('b', REQUIRED - 1n)]
    expect(() => selectPlatformSource(candidates, AMOUNT, FEE)).toThrow(/enough credits/)
  })

  it('throws when the amount is below the minimum output', () => {
    expect(() => selectPlatformSource([candidate('a', REQUIRED)], MIN_OUTPUT_CREDITS - 1n, FEE)).toThrow(/Minimum/)
  })

  it('uses the explicit source address when given', () => {
    const candidates = [candidate('a', REQUIRED + 9_000_000n), candidate('b', REQUIRED)]
    expect(selectPlatformSource(candidates, AMOUNT, FEE, 'b').platformAddress).toBe('b')
  })

  it('throws when the explicit source address is unknown', () => {
    expect(() => selectPlatformSource([candidate('a', REQUIRED)], AMOUNT, FEE, 'zzz')).toThrow(/not found/)
  })

  it('throws when the explicit source address cannot cover amount + fee', () => {
    const candidates = [candidate('a', REQUIRED + 9_000_000n), candidate('b', REQUIRED - 1n)]
    expect(() => selectPlatformSource(candidates, AMOUNT, FEE, 'b')).toThrow(/insufficient/)
  })
})

describe('platform fee helpers', () => {
  it('identity transfer fee scales with recipient count', () => {
    expect(identityTransferFeeCredits(1)).toBe(6_500_000n)
    expect(identityTransferFeeCredits(3)).toBe(18_500_000n)
  })

  it('identity create fee scales with public key count', () => {
    expect(identityCreateFeeCredits(4)).toBe(28_000_000n)
  })

  it('top-up fee scales with input count', () => {
    expect(topUpFeeCredits(1)).toBe(1_000_000n)
    expect(topUpFeeCredits(3)).toBe(2_000_000n)
  })
})

describe('toAddressInput', () => {
  // The candidate carries the address's own balance; the input carries what the
  // transition spends from it.
  it('takes the spend amount rather than the candidate balance', () => {
    const input = toAddressInput(candidate('addr-1', 9_000_000n, 4), 1_000_000n)

    expect(input).toEqual({platformAddress: 'addr-1', index: 0, nonce: 4, credits: 1_000_000n})
  })
})
