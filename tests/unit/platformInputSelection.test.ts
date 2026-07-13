import { describe, it, expect } from 'vitest'
import {
  selectPlatformInputs,
  PlatformSourceCandidate,
  MIN_INPUT_CREDITS,
  MAX_ADDRESS_INPUTS,
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

const FEE = 1_000_000n

describe('selectPlatformInputs', () => {
  it('uses a single input when the largest balance covers amount + fee', () => {
    const plan = selectPlatformInputs([candidate('a', 10_000_000n), candidate('b', 1_000_000n)], 5_000_000n, FEE)
    expect(plan.inputs).toHaveLength(1)
    expect(plan.inputs[0].candidate.platformAddress).toBe('a')
    expect(plan.inputs[0].credits).toBe(5_000_000n)
    expect(plan.feeCredits).toBe(FEE)
  })

  it('splits across inputs largest-first, charging the fee to input 0', () => {
    const plan = selectPlatformInputs([candidate('b', 3_000_000n), candidate('a', 5_000_000n)], 7_000_000n, FEE)
    expect(plan.inputs.map(input => input.candidate.platformAddress)).toEqual(['a', 'b'])
    expect(plan.inputs[0].credits).toBe(4_000_000n)
    expect(plan.inputs[1].credits).toBe(3_000_000n)
  })

  it('keeps every input at or above the per-input minimum by rebalancing the tail', () => {
    const plan = selectPlatformInputs([candidate('a', 5_000_000n), candidate('b', 200_000n)], 4_050_000n, FEE)
    expect(plan.inputs[0].credits).toBe(3_950_000n)
    expect(plan.inputs[1].credits).toBe(MIN_INPUT_CREDITS)
  })

  it('skips candidates whose usable balance is below the per-input minimum', () => {
    const candidates = [candidate('a', 1_000_000n), candidate('dust', 50_000n)]
    expect(() => selectPlatformInputs(candidates, 1_500_000n, 0n)).toThrow(/enough credits/)
  })

  it('stops at the maximum input count', () => {
    const candidates = Array.from({length: MAX_ADDRESS_INPUTS + 1}, (_, i) => candidate(`a${i}`, MIN_INPUT_CREDITS))
    const amount = MIN_INPUT_CREDITS * BigInt(MAX_ADDRESS_INPUTS + 1)
    expect(() => selectPlatformInputs(candidates, amount, 0n)).toThrow(/enough credits/)
  })

  it('selects exactly the maximum input count when that suffices', () => {
    const candidates = Array.from({length: MAX_ADDRESS_INPUTS}, (_, i) => candidate(`a${i}`, MIN_INPUT_CREDITS))
    const amount = MIN_INPUT_CREDITS * BigInt(MAX_ADDRESS_INPUTS)
    const plan = selectPlatformInputs(candidates, amount, 0n)
    expect(plan.inputs).toHaveLength(MAX_ADDRESS_INPUTS)
  })

  it('honors the preferred source address', () => {
    const plan = selectPlatformInputs([candidate('a', 10_000_000n), candidate('b', 7_000_000n)], 5_000_000n, FEE, 'b')
    expect(plan.inputs).toHaveLength(1)
    expect(plan.inputs[0].candidate.platformAddress).toBe('b')
  })

  it('throws when the preferred address is unknown', () => {
    expect(() => selectPlatformInputs([candidate('a', 10_000_000n)], 5_000_000n, FEE, 'zzz')).toThrow(/not found/)
  })

  it('throws when the preferred address cannot cover amount + fee', () => {
    expect(() => selectPlatformInputs([candidate('a', 5_999_999n)], 5_000_000n, FEE, 'a')).toThrow(/insufficient/)
  })

  it('throws when the amount is below the per-input minimum', () => {
    expect(() => selectPlatformInputs([candidate('a', 10_000_000n)], MIN_INPUT_CREDITS - 1n, FEE)).toThrow(/Minimum/)
  })

  it('throws when the total balance cannot cover the amount', () => {
    expect(() => selectPlatformInputs([candidate('a', 1_000_000n)], 5_000_000n, FEE)).toThrow(/enough credits/)
  })
})
