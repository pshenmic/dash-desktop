import { describe, it, expect } from 'vitest'
import {selectPlatformSource} from '../../src/main/src/utils/platformTransfer'
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

  it('rejects a balance the quoted fee has outgrown', () => {
    const candidates = [candidate('a', REQUIRED)]
    expect(() => selectPlatformSource(candidates, AMOUNT, FEE + 1n)).toThrow(/enough credits/)
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
