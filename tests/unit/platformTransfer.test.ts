import { describe, it, expect } from 'vitest'
import {
  selectPlatformSource,
  PlatformSourceCandidate,
  MIN_OUTPUT_CREDITS,
  TRANSFER_FEE_CREDITS,
} from '../../src/main/src/services/platformTransfer'

function candidate(platformAddress: string, balanceCredits: bigint, nonce = 0): PlatformSourceCandidate {
  return {
    platformAddress,
    coreAddress: `core-${platformAddress}`,
    derivationPath: `m/44'/1'/0'/0/0`,
    balanceCredits,
    nonce,
  }
}

const AMOUNT = 1_000_000n
const REQUIRED = AMOUNT + TRANSFER_FEE_CREDITS

describe('selectPlatformSource', () => {
  it('picks the largest balance that covers amount + fee', () => {
    const candidates = [
      candidate('a', REQUIRED),
      candidate('b', REQUIRED + 9_000_000n),
      candidate('c', REQUIRED + 1n),
    ]
    expect(selectPlatformSource(candidates, AMOUNT).platformAddress).toBe('b')
  })

  it('accepts a balance exactly equal to amount + fee', () => {
    expect(selectPlatformSource([candidate('a', REQUIRED)], AMOUNT).platformAddress).toBe('a')
  })

  it('throws when no address covers amount + fee', () => {
    const candidates = [candidate('a', AMOUNT), candidate('b', REQUIRED - 1n)]
    expect(() => selectPlatformSource(candidates, AMOUNT)).toThrow(/enough credits/)
  })

  it('throws when the amount is below the minimum output', () => {
    expect(() => selectPlatformSource([candidate('a', REQUIRED)], MIN_OUTPUT_CREDITS - 1n)).toThrow(/Minimum/)
  })

  it('uses the explicit source address when given', () => {
    const candidates = [candidate('a', REQUIRED + 9_000_000n), candidate('b', REQUIRED)]
    expect(selectPlatformSource(candidates, AMOUNT, 'b').platformAddress).toBe('b')
  })

  it('throws when the explicit source address is unknown', () => {
    expect(() => selectPlatformSource([candidate('a', REQUIRED)], AMOUNT, 'zzz')).toThrow(/not found/)
  })

  it('throws when the explicit source address cannot cover amount + fee', () => {
    const candidates = [candidate('a', REQUIRED + 9_000_000n), candidate('b', REQUIRED - 1n)]
    expect(() => selectPlatformSource(candidates, AMOUNT, 'b')).toThrow(/insufficient/)
  })
})
