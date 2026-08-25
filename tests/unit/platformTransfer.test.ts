import { describe, it, expect } from 'vitest'
import {selectPlatformInputs, selectPlatformSource, toAddressInput} from '../../src/main/src/utils/platformTransfer'
import {PlatformInputPlan, PlatformSourceCandidate} from '../../src/main/src/types/PlatformTransfer'
import {MAX_ADDRESS_INPUTS, MIN_INPUT_CREDITS, MIN_OUTPUT_CREDITS} from '../../src/main/src/constants'

// hashByte drives consensus ordering; platformAddress is only a label, so the
// two can disagree exactly as bech32m and address bytes do on chain.
function candidate(
  platformAddress: string,
  balanceCredits: bigint,
  nonce = 0,
  hashByte = platformAddress.charCodeAt(0),
): PlatformSourceCandidate {
  const addressBytes = new Uint8Array(21)
  addressBytes[1] = hashByte
  return {
    platformAddress,
    addressBytes,
    index: 0,
    balanceCredits,
    nonce,
  }
}

const AMOUNT = 1_000_000n
const FEE = 6_500_000n
const REQUIRED = AMOUNT + FEE

const INPUT_FEE = 1_000_000n

function consumed(plan: PlatformInputPlan, platformAddress: string): bigint {
  return plan.inputs
    .filter(input => input.candidate.platformAddress === platformAddress)
    .reduce((sum, input) => sum + input.credits, 0n)
}

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


describe('toAddressInput', () => {
  // The candidate carries the address's own balance; the input carries what the
  // transition spends from it.
  it('takes the spend amount rather than the candidate balance', () => {
    const input = toAddressInput(candidate('addr-1', 9_000_000n, 4), 1_000_000n)

    expect(input).toEqual({platformAddress: 'addr-1', index: 0, nonce: 4, credits: 1_000_000n})
  })
})

describe('selectPlatformInputs', () => {
  it('uses a single input when the largest balance covers amount + fee', () => {
    const plan = selectPlatformInputs([candidate('a', 10_000_000n), candidate('b', 1_000_000n)], 5_000_000n, INPUT_FEE)
    expect(plan.inputs).toHaveLength(1)
    expect(plan.inputs[0].candidate.platformAddress).toBe('a')
    expect(plan.inputs[0].credits).toBe(5_000_000n)
    expect(plan.feeCredits).toBe(INPUT_FEE)
  })

  it('splits across inputs largest-first, charging the fee to input 0', () => {
    const plan = selectPlatformInputs([candidate('b', 3_000_000n), candidate('a', 5_000_000n)], 7_000_000n, INPUT_FEE)
    expect(plan.inputs.map(input => input.candidate.platformAddress)).toEqual(['a', 'b'])
    expect(plan.inputs[0].credits).toBe(4_000_000n)
    expect(plan.inputs[1].credits).toBe(3_000_000n)
  })

  it('keeps every input at or above the per-input minimum', () => {
    const plan = selectPlatformInputs([candidate('a', 5_000_000n), candidate('b', 200_000n)], 4_050_000n, INPUT_FEE)
    expect(plan.inputs[0].credits).toBe(3_850_000n)
    expect(plan.inputs[1].credits).toBe(200_000n)
    for (const input of plan.inputs) {
      expect(input.credits).toBeGreaterThanOrEqual(MIN_INPUT_CREDITS)
    }
  })

  it('skips candidates whose usable balance is below the per-input minimum', () => {
    const candidates = [candidate('a', 1_000_000n), candidate('dust', 50_000n)]
    expect(() => selectPlatformInputs(candidates, 1_500_000n, 0n)).toThrow(/enough credits/)
  })

  it('stops at the maximum input count', () => {
    const candidates = Array.from({length: MAX_ADDRESS_INPUTS + 1}, (_, i) => candidate(`a${i}`, MIN_INPUT_CREDITS, 0, i))
    const amount = MIN_INPUT_CREDITS * BigInt(MAX_ADDRESS_INPUTS + 1)
    expect(() => selectPlatformInputs(candidates, amount, 0n)).toThrow(/enough credits/)
  })

  it('selects exactly the maximum input count when that suffices', () => {
    const candidates = Array.from({length: MAX_ADDRESS_INPUTS}, (_, i) => candidate(`a${i}`, MIN_INPUT_CREDITS, 0, i))
    const amount = MIN_INPUT_CREDITS * BigInt(MAX_ADDRESS_INPUTS)
    const plan = selectPlatformInputs(candidates, amount, 0n)
    expect(plan.inputs).toHaveLength(MAX_ADDRESS_INPUTS)
  })

  // Consensus resolves DeductFromInput(0) through the inputs' address order and
  // takes the fee from that input's REMAINING balance, so the address sorting
  // first must not be spent down to nothing.
  it('leaves the fee to the address that sorts first, not the largest balance', () => {
    const feePayer = candidate('small-but-first', 3_000_000n, 0, 0x01)
    const peer = candidate('large-but-second', 9_000_000n, 0, 0x02)

    const plan = selectPlatformInputs([peer, feePayer], 11_000_000n, INPUT_FEE)

    expect(feePayer.balanceCredits - consumed(plan, 'small-but-first')).toBeGreaterThanOrEqual(INPUT_FEE)
    expect(consumed(plan, 'large-but-second')).toBe(9_000_000n)
    expect(plan.inputs.reduce((sum, input) => sum + input.credits, 0n)).toBe(11_000_000n)
  })

  it('orders inputs the way consensus does, so DeductFromInput(0) is inputs[0]', () => {
    const plan = selectPlatformInputs(
      [candidate('largest', 9_000_000n, 0, 0x03), candidate('first-by-address', 3_000_000n, 0, 0x01)],
      11_000_000n,
      INPUT_FEE,
    )

    expect(plan.inputs.map(input => input.candidate.platformAddress)).toEqual(['first-by-address', 'largest'])
  })

  it('refuses when the first-sorting address cannot both fund and cover the fee', () => {
    const candidates = [
      candidate('tiny-but-first', 1_000_000n, 0, 0x01),
      candidate('b', 4_000_000n, 0, 0x02),
      candidate('c', 4_000_000n, 0, 0x03),
    ]

    expect(() => selectPlatformInputs(candidates, 8_000_000n, INPUT_FEE)).toThrow(/consolidate/)
  })

  it('keeps the fee out of an explicitly chosen source address', () => {
    const chosen = candidate('a', 5_000_000n)
    const plan = selectPlatformInputs([chosen], 4_000_000n, INPUT_FEE, 'a')

    expect(chosen.balanceCredits - plan.inputs[0].credits).toBeGreaterThanOrEqual(INPUT_FEE)
  })

  it('honors the preferred source address', () => {
    const plan = selectPlatformInputs([candidate('a', 10_000_000n), candidate('b', 7_000_000n)], 5_000_000n, INPUT_FEE, 'b')
    expect(plan.inputs).toHaveLength(1)
    expect(plan.inputs[0].candidate.platformAddress).toBe('b')
  })

  it('throws when the preferred address is unknown', () => {
    expect(() => selectPlatformInputs([candidate('a', 10_000_000n)], 5_000_000n, INPUT_FEE, 'zzz')).toThrow(/not found/)
  })

  it('throws when the preferred address cannot cover amount + fee', () => {
    expect(() => selectPlatformInputs([candidate('a', 5_999_999n)], 5_000_000n, INPUT_FEE, 'a')).toThrow(/insufficient/)
  })

  it('throws when the amount is below the per-input minimum', () => {
    expect(() => selectPlatformInputs([candidate('a', 10_000_000n)], MIN_INPUT_CREDITS - 1n, INPUT_FEE)).toThrow(/Minimum/)
  })

  it('throws when the total balance cannot cover the amount', () => {
    expect(() => selectPlatformInputs([candidate('a', 1_000_000n)], 5_000_000n, INPUT_FEE)).toThrow(/enough credits/)
  })
})
