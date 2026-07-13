import { describe, it, expect } from 'vitest'
import {
  selectPlatformSource,
  PlatformSourceCandidate,
  MIN_OUTPUT_CREDITS,
  TRANSFER_FEE_CREDITS,
  identityTransferFeeCredits,
  addressTransferFeeCredits,
  identityCreateFeeCredits,
  topUpFeeCredits,
} from '../../src/main/src/utils/platformTransfer'

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

describe('platform fee helpers', () => {
  it('identity transfer fee scales with recipient count', () => {
    expect(identityTransferFeeCredits(1)).toBe(6_500_000n)
    expect(identityTransferFeeCredits(3)).toBe(18_500_000n)
  })

  it('address transfer fee for one input and one output matches the legacy constant', () => {
    expect(addressTransferFeeCredits(1, 1)).toBe(TRANSFER_FEE_CREDITS)
    expect(addressTransferFeeCredits(2, 3)).toBe(19_000_000n)
  })

  it('identity create fee scales with public key count', () => {
    expect(identityCreateFeeCredits(4)).toBe(28_000_000n)
  })

  it('top-up fee scales with input count', () => {
    expect(topUpFeeCredits(1)).toBe(1_000_000n)
    expect(topUpFeeCredits(3)).toBe(2_000_000n)
  })
})
