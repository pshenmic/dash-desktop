import { describe, it, expect } from 'vitest'
import {
  maxPlatformCredits,
  requireAutomaticInputs,
  selectPlatformInputs,
  selectPlatformSource,
  requireRecipients,
  selectablePlatformInputs,
  toAddressInput,
} from '../../src/main/src/utils/platformTransfer'
import {Recipient} from '../../src/main/platform/types/messages'
import {
  PlatformFeeStep,
  PlatformInputOutcome,
  PlatformInputPlan,
  PlatformPickedInput,
  PlatformSourceCandidate,
  PlatformSpendSource,
} from '../../src/main/src/types/PlatformTransfer'
import {
  MAX_ADDRESS_INPUTS,
  MAX_FEE_STRATEGY_STEPS,
  MAX_RECIPIENTS,
  MIN_INPUT_CREDITS,
  MIN_OUTPUT_CREDITS,
} from '../../src/main/src/constants/credits'

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

const from = (address: string): PlatformSpendSource => ({kind: 'address', address})

// The pair every caller runs: the one filter, then the plan over what survived.
function inputsFor(
  candidates: PlatformSourceCandidate[],
  amountCredits: bigint,
  feeCredits: bigint,
  source?: PlatformSpendSource,
  outputCount = 0,
): PlatformInputOutcome {
  return selectPlatformInputs(
    selectablePlatformInputs(candidates, source), amountCredits, feeCredits, source, outputCount)
}

const pick = (
  inputs: PlatformPickedInput[],
  feeStrategy: PlatformFeeStep[] = [{kind: 'deductFromInput', address: inputs[0]?.address ?? ''}],
): PlatformSpendSource => ({kind: 'inputs', inputs, feeStrategy})

const input = (address: string, credits: bigint): PlatformPickedInput => ({address, credits})

function consumed(plan: PlatformInputPlan | null, platformAddress: string): bigint {
  return (plan?.inputs ?? [])
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
    const {plan} = inputsFor([candidate('a', 10_000_000n), candidate('b', 1_000_000n)], 5_000_000n, INPUT_FEE)
    expect(plan!.inputs).toHaveLength(1)
    expect(plan!.inputs[0].candidate.platformAddress).toBe('a')
    expect(plan!.inputs[0].credits).toBe(5_000_000n)
    expect(plan!.feeCredits).toBe(INPUT_FEE)
  })

  it('splits across inputs largest-first, charging the fee to input 0', () => {
    const {plan} = inputsFor([candidate('b', 3_000_000n), candidate('a', 5_000_000n)], 7_000_000n, INPUT_FEE)
    expect(plan!.inputs.map(input => input.candidate.platformAddress)).toEqual(['a', 'b'])
    expect(plan!.inputs[0].credits).toBe(4_000_000n)
    expect(plan!.inputs[1].credits).toBe(3_000_000n)
  })

  it('keeps every input at or above the per-input minimum', () => {
    const {plan} = inputsFor([candidate('a', 5_000_000n), candidate('b', 200_000n)], 4_050_000n, INPUT_FEE)
    expect(plan!.inputs[0].credits).toBe(3_850_000n)
    expect(plan!.inputs[1].credits).toBe(200_000n)
    for (const input of plan!.inputs) {
      expect(input.credits).toBeGreaterThanOrEqual(MIN_INPUT_CREDITS)
    }
  })

  it('skips candidates whose usable balance is below the per-input minimum', () => {
    const candidates = [candidate('a', 1_000_000n), candidate('dust', 50_000n)]
    expect(inputsFor(candidates, 1_500_000n, 0n).error).toMatch(/enough credits/)
  })

  it('stops at the maximum input count', () => {
    const candidates = Array.from({length: MAX_ADDRESS_INPUTS + 1}, (_, i) => candidate(`a${i}`, MIN_INPUT_CREDITS, 0, i))
    const amount = MIN_INPUT_CREDITS * BigInt(MAX_ADDRESS_INPUTS + 1)
    expect(inputsFor(candidates, amount, 0n).error).toMatch(/enough credits/)
  })

  it('selects exactly the maximum input count when that suffices', () => {
    const candidates = Array.from({length: MAX_ADDRESS_INPUTS}, (_, i) => candidate(`a${i}`, MIN_INPUT_CREDITS, 0, i))
    const amount = MIN_INPUT_CREDITS * BigInt(MAX_ADDRESS_INPUTS)
    const {plan} = inputsFor(candidates, amount, 0n)
    expect(plan!.inputs).toHaveLength(MAX_ADDRESS_INPUTS)
  })

  // Consensus resolves DeductFromInput(0) through the inputs' address order and
  // takes the fee from that input's REMAINING balance, so the address sorting
  // first must not be spent down to nothing.
  it('leaves the fee to the address that sorts first, not the largest balance', () => {
    const feePayer = candidate('small-but-first', 3_000_000n, 0, 0x01)
    const peer = candidate('large-but-second', 9_000_000n, 0, 0x02)

    const {plan} = inputsFor([peer, feePayer], 11_000_000n, INPUT_FEE)

    expect(feePayer.balanceCredits - consumed(plan, 'small-but-first')).toBeGreaterThanOrEqual(INPUT_FEE)
    expect(consumed(plan, 'large-but-second')).toBe(9_000_000n)
    expect(plan!.inputs.reduce((sum, input) => sum + input.credits, 0n)).toBe(11_000_000n)
  })

  it('orders inputs the way consensus does, so DeductFromInput(0) is inputs[0]', () => {
    const {plan} = inputsFor(
      [candidate('largest', 9_000_000n, 0, 0x03), candidate('first-by-address', 3_000_000n, 0, 0x01)],
      11_000_000n,
      INPUT_FEE,
    )

    expect(plan!.inputs.map(input => input.candidate.platformAddress)).toEqual(['first-by-address', 'largest'])
  })

  it('refuses when the first-sorting address cannot both fund and cover the fee', () => {
    const candidates = [
      candidate('tiny-but-first', 1_000_000n, 0, 0x01),
      candidate('b', 4_000_000n, 0, 0x02),
      candidate('c', 4_000_000n, 0, 0x03),
    ]

    expect(inputsFor(candidates, 8_000_000n, INPUT_FEE).error).toMatch(/consolidate/)
  })

  it('keeps the fee out of an explicitly chosen source address', () => {
    const chosen = candidate('a', 5_000_000n)
    const {plan} = inputsFor([chosen], 4_000_000n, INPUT_FEE, from('a'))

    expect(chosen.balanceCredits - plan!.inputs[0].credits).toBeGreaterThanOrEqual(INPUT_FEE)
  })

  it('honors the chosen source address', () => {
    const {plan} = inputsFor([candidate('a', 10_000_000n), candidate('b', 7_000_000n)], 5_000_000n, INPUT_FEE, from('b'))
    expect(plan!.inputs).toHaveLength(1)
    expect(plan!.inputs[0].candidate.platformAddress).toBe('b')
  })

  it('throws when a chosen address is unknown', () => {
    expect(inputsFor([candidate('a', 10_000_000n)], 5_000_000n, INPUT_FEE, from('zzz')).error).toMatch(/insufficient/)
  })

  it('throws when the chosen address cannot cover amount + fee', () => {
    expect(inputsFor([candidate('a', 5_999_999n)], 5_000_000n, INPUT_FEE, from('a')).error).toMatch(/insufficient/)
  })

  it('throws when the amount is below the per-input minimum', () => {
    expect(inputsFor([candidate('a', 10_000_000n)], MIN_INPUT_CREDITS - 1n, INPUT_FEE).error).toMatch(/Minimum/)
  })

  it('throws when the total balance cannot cover the amount', () => {
    expect(inputsFor([candidate('a', 1_000_000n)], 5_000_000n, INPUT_FEE).error).toMatch(/enough credits/)
  })
})

describe('funding a transition from picked inputs', () => {
  const candidates = [
    candidate('a', 5_000_000n),
    candidate('b', 5_000_000n),
    candidate('c', 5_000_000n),
  ]

  // The charged input keeps the fee back out of what it was given, which is the
  // only credits an address-funded transition leaves behind.
  it('puts in what each input was given, less the fee on the one charged', () => {
    const {plan} = inputsFor(
      candidates, 3_000_000n, INPUT_FEE, pick([input('a', 2_000_000n), input('b', 2_000_000n)]))

    expect(plan!.inputs.map(entry => [entry.candidate.platformAddress, entry.credits]))
      .toEqual([['a', 1_000_000n], ['b', 2_000_000n]])
  })

  // The picked order is the user's; the built order is the one consensus reads
  // a fee index against.
  it('orders the inputs by address bytes whatever order they were picked in', () => {
    const {plan} = inputsFor(
      candidates, 3_000_000n, INPUT_FEE, pick([input('c', 2_000_000n), input('a', 2_000_000n)]))

    expect(plan!.inputs.map(entry => entry.candidate.platformAddress)).toEqual(['a', 'c'])
  })

  it('resolves the fee payer to its position among the sorted inputs', () => {
    const {plan} = inputsFor(
      candidates, 3_000_000n, INPUT_FEE,
      pick([input('c', 2_000_000n), input('a', 2_000_000n)], [{kind: 'deductFromInput', address: 'c'}]))

    expect(plan!.feeStrategy).toEqual([{kind: 'deductFromInput', index: 1}])
  })

  it('refuses when the picked addresses cannot cover the amount and the fee', () => {
    const outcome = inputsFor(
      candidates, 3_000_000n, INPUT_FEE, pick([input('a', 2_000_000n)]))

    expect(outcome.error).toMatch(/keep back/)
  })

  // What an input does not draw stays on its address, which is the only change
  // an address-funded transition has.
  it('draws only what the amount needs, leaving the rest on the addresses', () => {
    const {plan} = inputsFor(
      candidates, 2_000_000n, INPUT_FEE, pick([input('a', 4_000_000n), input('b', 4_000_000n)]))

    expect(plan!.inputs.reduce((sum, entry) => sum + entry.credits, 0n)).toBe(2_000_000n)
  })

  // A share below the protocol minimum cannot be its own input, so the address
  // paying the fee carries it instead.
  it('leaves out a picked address whose share would be below the minimum', () => {
    const {plan} = inputsFor(
      candidates, 2_000_000n, INPUT_FEE,
      pick([input('a', 2_000_000n), input('b', MIN_INPUT_CREDITS - 1n)]))

    expect(plan!.inputs.map(entry => entry.candidate.platformAddress)).toEqual(['a'])
  })

  it('refuses an input larger than its address holds', () => {
    expect(() => inputsFor(candidates, 6_000_000n, INPUT_FEE, pick([input('a', 6_000_000n)])))
      .toThrow('no longer holds')
  })

  // Each input carries the address's next nonce, so a second one would replay it.
  it('refuses the same address twice', () => {
    const outcome = inputsFor(
      candidates, 2_000_000n, INPUT_FEE, pick([input('a', 1_000_000n), input('a', 1_000_000n)]))

    expect(outcome.error).toMatch(/only once/)
  })

  it('refuses more inputs than a transition takes', () => {
    const many = Array.from({length: MAX_ADDRESS_INPUTS + 1}, (_, i) => candidate(`a${i}`, 5_000_000n, 0, i + 1))
    const picked = many.map(entry => input(entry.platformAddress, MIN_INPUT_CREDITS))
    const amount = MIN_INPUT_CREDITS * BigInt(picked.length)

    expect(inputsFor(many, amount, INPUT_FEE, pick(picked)).error).toMatch(/at most/)
  })

  // Consensus refuses an input below the per-input minimum, and a pick funding
  // less than one leaves the charged address carrying exactly that.
  it('refuses an amount no single input could carry', () => {
    const outcome = inputsFor(
      candidates, MIN_INPUT_CREDITS - 1n, INPUT_FEE, pick([input('a', 5_000_000n)]))

    expect(outcome.error).toMatch(/Minimum amount/)
  })

  it('refuses an empty pick', () => {
    expect(inputsFor(candidates, 1_000_000n, INPUT_FEE, pick([])).error).toMatch(/at least one address/)
  })

  it('refuses an address this wallet does not hold', () => {
    expect(() => inputsFor(candidates, 1_000_000n, INPUT_FEE, pick([input('zzz', 1_000_000n)])))
      .toThrow('no longer holds')
  })

  it('refuses when the fee payer does not keep back the fee', () => {
    const outcome = inputsFor(
      [candidate('a', 1_050_000n)], MIN_INPUT_CREDITS, INPUT_FEE, pick([input('a', 1_050_000n)]))

    expect(outcome.error).toMatch(/keep back/)
  })
})

describe('the fee strategy a picked set carries', () => {
  const candidates = [candidate('a', 5_000_000n), candidate('b', 5_000_000n)]
  const picked = [input('a', 2_000_000n), input('b', 1_000_000n)]

  // Nothing is charged, so nothing keeps the fee back and the inputs add up to
  // everything they were given.
  const UNCHARGED = 3_000_000n

  it('refuses a fee payer that is not one of the inputs', () => {
    const outcome = inputsFor(
      candidates, UNCHARGED, INPUT_FEE, pick(picked, [{kind: 'deductFromInput', address: 'b2'}]))

    expect(outcome.error).toMatch(/not one of the inputs/)
  })

  it('refuses an empty strategy', () => {
    expect(inputsFor(candidates, UNCHARGED, INPUT_FEE, pick(picked, [])).error).toMatch(/must name who pays/)
  })

  it('refuses more steps than a transition takes', () => {
    const steps: PlatformFeeStep[] = Array.from(
      {length: MAX_FEE_STRATEGY_STEPS + 1}, () => ({kind: 'deductFromInput', address: 'a'}))

    expect(inputsFor(candidates, 2_000_000n, INPUT_FEE, pick(picked, steps)).error).toMatch(/at most/)
  })

  it('refuses a strategy that charges one input twice', () => {
    const steps: PlatformFeeStep[] = [
      {kind: 'deductFromInput', address: 'a'},
      {kind: 'deductFromInput', address: 'a'},
    ]

    expect(inputsFor(candidates, 2_000_000n, INPUT_FEE, pick(picked, steps)).error).toMatch(/twice/)
  })

  // These transitions fund a withdrawal script or an identity, not an output a
  // fee step can index.
  it('refuses reducing an output on an operation that carries none', () => {
    const outcome = inputsFor(
      candidates, UNCHARGED, INPUT_FEE, pick(picked, [{kind: 'reduceOutput', index: 0}]))

    expect(outcome.error).toMatch(/no output/)
  })

  it('takes the fee out of an output when the operation has one', () => {
    const {plan} = inputsFor(
      candidates, UNCHARGED, INPUT_FEE, pick(picked, [{kind: 'reduceOutput', index: 0}]), 1)

    expect(plan!.feeStrategy).toEqual([{kind: 'reduceOutput', index: 0}])
  })

  // Nothing else names an input, so an automatic plan still says index 0 —
  // which is the address that sorts first, the one it loaded lightly.
  it('charges the first sorted input when the wallet plans the split', () => {
    const {plan} = inputsFor(candidates, 2_000_000n, INPUT_FEE)

    expect(plan!.feeStrategy).toEqual([{kind: 'deductFromInput', index: 0}])
  })
})

describe('selectablePlatformInputs', () => {
  it('drops addresses that cannot be an input of their own', () => {
    const candidates = [candidate('a', 5_000_000n), candidate('b', MIN_INPUT_CREDITS - 1n)]

    expect(selectablePlatformInputs(candidates).map(entry => entry.platformAddress)).toEqual(['a'])
  })

  it('narrows to the address a source names', () => {
    const candidates = [candidate('a', 5_000_000n), candidate('b', 5_000_000n)]

    expect(selectablePlatformInputs(candidates, from('b')).map(entry => entry.platformAddress)).toEqual(['b'])
  })

  it('yields nothing for an address this wallet does not hold', () => {
    expect(selectablePlatformInputs([candidate('a', 5_000_000n)], from('zzz'))).toEqual([])
  })

  it('refuses a picked address whose balance no longer covers its input', () => {
    const candidates = [candidate('a', 1_000_000n)]

    expect(() => selectablePlatformInputs(candidates, pick([input('a', 2_000_000n)])))
      .toThrow('no longer holds')
  })

  it('refuses a picked address this wallet does not hold', () => {
    expect(() => selectablePlatformInputs([candidate('a', 5_000_000n)], pick([input('zzz', 1_000_000n)])))
      .toThrow('no longer holds')
  })
})

describe('maxPlatformCredits', () => {
  const fee = async (inputCount: number): Promise<bigint> => BigInt(inputCount) * INPUT_FEE

  it('is the best prefix, not the balance minus a fee', async () => {
    const candidates = [candidate('a', 5_000_000n), candidate('b', 500_000n)]

    // Adding b costs a whole extra fee and brings less than that in.
    expect(await maxPlatformCredits(candidates, fee)).toBe(4_000_000n)
  })

  it('adds an address that brings in more than it costs', async () => {
    const candidates = [candidate('a', 5_000_000n), candidate('b', 4_000_000n)]

    expect(await maxPlatformCredits(candidates, fee)).toBe(7_000_000n)
  })

  it('is zero when the fee outruns every prefix', async () => {
    expect(await maxPlatformCredits([candidate('a', 900_000n)], fee)).toBe(0n)
  })

  it('is what a picked set was given, less the fee its count carries', async () => {
    const candidates = [candidate('a', 5_000_000n), candidate('b', 5_000_000n)]
    const source = pick([input('a', 3_000_000n), input('b', 4_000_000n)])

    expect(await maxPlatformCredits(candidates, fee, source)).toBe(5_000_000n)
  })

  it('offers exactly what a picked set funds', async () => {
    const candidates = [candidate('a', 5_000_000n), candidate('b', 5_000_000n)]
    const source = pick([input('a', 3_000_000n), input('b', 4_000_000n)])
    const max = await maxPlatformCredits(candidates, fee, source)
    const {plan} = inputsFor(candidates, max, await fee(2), source)

    expect(plan!.inputs.reduce((sum, entry) => sum + entry.credits, 0n)).toBe(max)
  })

  it('funds exactly what it offers', async () => {
    const candidates = [candidate('a', 5_000_000n), candidate('b', 4_000_000n)]
    const max = await maxPlatformCredits(candidates, fee)
    const {plan} = inputsFor(candidates, max, await fee(2))

    expect(plan!.inputs.reduce((sum, entry) => sum + entry.credits, 0n)).toBe(max)
  })
})

describe('requireAutomaticInputs', () => {
  it('accepts an operation that named no source', () => {
    expect(() => requireAutomaticInputs(null)).not.toThrow()
  })

  // A pick names platform addresses, so it matches nothing an identity or the
  // pool would spend.
  it('refuses a pick on an operation platform addresses do not fund', () => {
    expect(() => requireAutomaticInputs(from('a'))).toThrow('address-funded operations only')
  })
})

describe('requireRecipients', () => {
  const to = (address: string, amountCredits: bigint): Recipient => ({address, amountCredits})

  it('totals what the transition pays out', () => {
    expect(requireRecipients([to('a', MIN_OUTPUT_CREDITS), to('b', MIN_OUTPUT_CREDITS * 2n)]))
      .toBe(MIN_OUTPUT_CREDITS * 3n)
  })

  it('refuses no recipients at all', () => {
    expect(() => requireRecipients([])).toThrow(/between 1 and/)
  })

  it('refuses more recipients than a transition carries', () => {
    const many = Array.from({length: MAX_RECIPIENTS + 1}, (_, i) => to(`a${i}`, MIN_OUTPUT_CREDITS))

    expect(() => requireRecipients(many)).toThrow(/between 1 and/)
  })

  // Consensus keys outputs by address, so a repeated one is a single merged
  // payment rather than the two the caller asked for.
  it('refuses the same recipient twice', () => {
    expect(() => requireRecipients([to('a', MIN_OUTPUT_CREDITS), to('a', MIN_OUTPUT_CREDITS)]))
      .toThrow(/only once/)
  })

  it('refuses a recipient below the per-output minimum', () => {
    expect(() => requireRecipients([to('a', MIN_OUTPUT_CREDITS - 1n)])).toThrow(/Minimum amount per recipient/)
  })
})
