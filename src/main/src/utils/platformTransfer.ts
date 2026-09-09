import {
  PlatformInputOutcome,
  PlatformInputSelection,
  PlatformSourceCandidate,
  PlatformSpendSource,
} from '../types/PlatformTransfer'
import {AddressInput, Recipient} from '../../platform/types/messages'
import {MAX_ADDRESS_INPUTS, MAX_RECIPIENTS, MIN_INPUT_CREDITS, MIN_OUTPUT_CREDITS} from '../constants/credits'
import {DEDUCT_FROM_FIRST_INPUT, resolveFeeStrategy} from './platformFeeStrategy'

// The count is only known once the selection stops, and each count is a worker
// round trip, so what crosses is the price of a count rather than a price.
export type PlatformFeeForInputs = (inputCount: number) => Promise<bigint>

// Consensus keys outputs by address, so a repeated recipient would be one
// merged payment rather than the two the caller asked for.
export function requireRecipients(recipients: Recipient[]): bigint {
  if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
    throw new Error(`Recipient count must be between 1 and ${MAX_RECIPIENTS}`)
  }
  if (new Set(recipients.map(recipient => recipient.address)).size !== recipients.length) {
    throw new Error('Each recipient can appear only once')
  }
  for (const recipient of recipients) {
    if (recipient.amountCredits < MIN_OUTPUT_CREDITS) {
      throw new Error(`Minimum amount per recipient is ${MIN_OUTPUT_CREDITS.toString()} credits`)
    }
  }
  return recipients.reduce((sum, recipient) => sum + recipient.amountCredits, 0n)
}

export function toAddressInput(candidate: PlatformSourceCandidate, credits: bigint): AddressInput {
  return {
    platformAddress: candidate.platformAddress,
    index: candidate.index,
    nonce: candidate.nonce,
    credits,
  }
}

// A pick names platform addresses, so it matches nothing an L1 send, an identity
// or the pool would spend. Refused rather than silently dropped.
export function requireAutomaticInputs(source?: PlatformSpendSource | null): void {
  if (source != null) {
    throw new Error('Input selection applies to address-funded operations only')
  }
}

// Every address a transition may draw on. The quote and the send price the same
// balances, so this is the one filter that decides what either may spend.
export function selectablePlatformInputs(
  candidates: PlatformSourceCandidate[],
  source?: PlatformSpendSource | null,
): PlatformSourceCandidate[] {
  // A pick names its addresses; whether they still hold what it draws is the
  // plan's to refuse, not this filter's to throw on. A quote asks before the
  // pick is affordable and has to answer a stale one rather than fail on it.
  if (source?.kind === 'inputs') {
    const picked = new Set(source.inputs.map(input => input.address))
    return candidates.filter(candidate => picked.has(candidate.platformAddress))
  }

  return candidates
    .filter(candidate => candidate.balanceCredits >= MIN_INPUT_CREDITS)
    .filter(candidate => source == null || candidate.platformAddress === source.address)
}

// Consensus takes the fee from the remaining balance of the input its strategy
// resolves to, indexed against the inputs in the order they are submitted.
export function selectPlatformInputs(
  selectable: PlatformSourceCandidate[],
  amountCredits: bigint,
  feeCredits: bigint,
  source?: PlatformSpendSource | null,
  outputCount = 0,
): PlatformInputOutcome {
  // Below one input's worth nothing can be funded: whatever carries the amount
  // would itself be an input consensus refuses.
  if (amountCredits < MIN_INPUT_CREDITS) {
    return refuse(`Minimum amount is ${MIN_INPUT_CREDITS.toString()} credits`)
  }

  // A picked set names the addresses to draw on rather than a walk to run, so
  // the allocation is the only thing left to decide.
  if (source?.kind === 'inputs') {
    return planPickedInputs(selectable, source, amountCredits, feeCredits, outputCount)
  }
  const sorted = [...selectable].sort(byBalanceDesc)
  const prefix: PlatformSourceCandidate[] = []
  let accumulated = 0n

  for (const candidate of sorted) {
    if (prefix.length === MAX_ADDRESS_INPUTS) break

    prefix.push(candidate)
    accumulated += candidate.balanceCredits
    if (accumulated < amountCredits + feeCredits) continue

    const allocatable = prefix.map(entry => ({candidate: entry, cap: entry.balanceCredits}))
    const feeTarget = allocatable.reduce((first, entry) =>
      compareAddresses(entry.candidate, first.candidate) < 0 ? entry : first)
    const inputs = allocate(allocatable, feeTarget, amountCredits, feeCredits)
    if (inputs !== null) {
      return {plan: {inputs, feeCredits, feeStrategy: DEDUCT_FROM_FIRST_INPUT}, error: null}
    }
  }

  if (accumulated < amountCredits + feeCredits) {
    return refuse(source == null
      ? 'Platform addresses do not hold enough credits for this amount plus fee'
      : 'Source address has insufficient credits for this amount plus fee')
  }
  return refuse(
    'No combination of addresses leaves the fee-paying address enough remaining credits; '
    + 'consolidate funds into fewer addresses and try again',
  )
}

// Not the balance minus a fee: an address worth less than what it adds to the
// fee leaves the set able to send less, so the answer is the best prefix.
export async function maxPlatformCredits(
  selectable: PlatformSourceCandidate[],
  feeForInputs: PlatformFeeForInputs,
  source?: PlatformSpendSource | null,
): Promise<bigint> {
  // No prefix to choose from when every input is named: the price is the one
  // that count carries, whether or not a smaller set would have been cheaper.
  if (source?.kind === 'inputs') {
    const total = source.inputs.reduce((sum, input) => sum + input.credits, 0n)
    const charged = source.feeStrategy.some(step => step.kind === 'deductFromInput')
    const spendable = charged ? total - await feeForInputs(source.inputs.length) : total
    return spendable > 0n ? spendable : 0n
  }

  const sorted = [...selectable].sort(byBalanceDesc).slice(0, MAX_ADDRESS_INPUTS)
  const prefix: PlatformSourceCandidate[] = []
  let accumulated = 0n
  let max = 0n

  for (const candidate of sorted) {
    prefix.push(candidate)
    accumulated += candidate.balanceCredits

    const feeCredits = await feeForInputs(prefix.length)
    const feeTarget = prefix.reduce((first, entry) => compareAddresses(entry, first) < 0 ? entry : first)
    // The address consensus charges still has to be an input of its own.
    if (feeTarget.balanceCredits - feeCredits < MIN_INPUT_CREDITS) continue

    const spendable = accumulated - feeCredits
    if (spendable > max) max = spendable
  }

  return max
}

// The fee scales with the input count, and covering a larger fee can pull in
// another input, so re-select until the count the fee was quoted for holds.
export async function selectPlatformInputsWithFee(
  selectable: PlatformSourceCandidate[],
  amountCredits: bigint,
  feeForInputs: PlatformFeeForInputs,
  source?: PlatformSpendSource | null,
  outputCount = 0,
): Promise<PlatformInputOutcome> {
  // A picked set fixes the count, so its price is settled in one quote.
  if (source?.kind === 'inputs') {
    const feeCredits = await feeForInputs(Math.max(source.inputs.length, 1))
    return selectPlatformInputs(selectable, amountCredits, feeCredits, source, outputCount)
  }

  let inputCount = 1
  for (;;) {
    const outcome = selectPlatformInputs(
      selectable, amountCredits, await feeForInputs(inputCount), source, outputCount)
    if (outcome.plan === null || outcome.plan.inputs.length <= inputCount) {
      return outcome
    }
    inputCount = outcome.plan.inputs.length
  }
}

// A pick names addresses and a payer; how much each puts in is still allocated,
// because what an input does not draw stays on its address.
function planPickedInputs(
  selectable: PlatformSourceCandidate[],
  source: Extract<PlatformSpendSource, {kind: 'inputs'}>,
  amountCredits: bigint,
  feeCredits: bigint,
  outputCount: number,
): PlatformInputOutcome {
  const picked = source.inputs

  if (picked.length === 0) {
    return refuse('Pick at least one address to fund this transition')
  }
  if (picked.length > MAX_ADDRESS_INPUTS) {
    return refuse(`A transition takes at most ${MAX_ADDRESS_INPUTS} inputs`)
  }
  // An input carries its address's next nonce, so two of them would replay it.
  if (new Set(picked.map(input => input.address)).size !== picked.length) {
    return refuse('An address can fund a transition only once')
  }

  const byAddress = new Map(selectable.map(candidate => [candidate.platformAddress, candidate]))
  const allocatable: AllocatableInput[] = []

  for (const input of picked) {
    const candidate = byAddress.get(input.address)
    if (candidate == null) {
      return refuse('Source address not found in this wallet')
    }
    if (candidate.balanceCredits < input.credits) {
      return refuse('Selected address no longer holds these credits')
    }
    // Every picked address has to become an input of its own, and one drawing
    // less than the protocol floor cannot. Refused rather than allocated around,
    // which would fund the transition from fewer addresses than were picked.
    if (input.credits < MIN_INPUT_CREDITS) {
      return refuse(`Each selected address must fund at least ${MIN_INPUT_CREDITS.toString()} credits`)
    }
    allocatable.push({candidate, cap: input.credits})
  }

  const charged = source.feeStrategy.filter(step => step.kind === 'deductFromInput')
  // A fee taken out of the output leaves every input free to spend its whole cap.
  const feeTarget = charged.length === 0
    ? allocatable.reduce((first, entry) => compareAddresses(entry.candidate, first.candidate) < 0 ? entry : first)
    : allocatable.find(entry => entry.candidate.platformAddress === charged[0].address)
  if (feeTarget == null) {
    return refuse('The address paying the fee is not one of the inputs')
  }

  const inputs = allocate(allocatable, feeTarget, amountCredits, charged.length === 0 ? 0n : feeCredits)
  if (inputs === null) {
    return refuse(`${feeTarget.candidate.platformAddress} does not keep back enough credits to pay the fee`)
  }

  const {steps, error} = resolveFeeStrategy(source.feeStrategy, inputs, outputCount)
  if (steps === null) return refuse(error)

  return {plan: {inputs, feeCredits, feeStrategy: steps}, error: null}
}

function refuse(error: string): PlatformInputOutcome {
  return {plan: null, error}
}

const byBalanceDesc = (a: PlatformSourceCandidate, b: PlatformSourceCandidate): number =>
  a.balanceCredits === b.balanceCredits ? 0 : a.balanceCredits > b.balanceCredits ? -1 : 1

// How much of one address a transition may draw. What it does not draw stays
// where it is, which is the only change an address-funded transition has.
interface AllocatableInput {
  candidate: PlatformSourceCandidate
  cap: bigint
}

// Loads the fee-paying address as lightly as its peers allow, so what it keeps
// back covers the fee. Null means these inputs cannot fund the amount.
function allocate(
  allocatable: AllocatableInput[],
  feeTarget: AllocatableInput,
  amountCredits: bigint,
  feeCredits: bigint,
): PlatformInputSelection[] | null {
  const keptBack = feeTarget.candidate.balanceCredits - feeCredits
  const feeTargetMax = feeTarget.cap < keptBack ? feeTarget.cap : keptBack
  if (feeTargetMax < MIN_INPUT_CREDITS) return null

  const peersTotal = allocatable.reduce(
    (sum, entry) => entry === feeTarget ? sum : sum + entry.cap, 0n)
  const shortfall = amountCredits - peersTotal
  const feeTargetMin = shortfall > MIN_INPUT_CREDITS ? shortfall : MIN_INPUT_CREDITS
  if (feeTargetMin > feeTargetMax) return null

  const inputs: PlatformInputSelection[] = []
  let remaining = amountCredits - feeTargetMin

  for (const entry of allocatable) {
    if (entry === feeTarget || remaining === 0n) continue
    const credits = entry.cap < remaining ? entry.cap : remaining
    // A share below the protocol minimum cannot be its own input; the fee
    // target carries it instead.
    if (credits < MIN_INPUT_CREDITS) continue
    inputs.push({candidate: entry.candidate, credits})
    remaining -= credits
  }

  const feeTargetCredits = feeTargetMin + remaining
  if (feeTargetCredits > feeTargetMax) return null

  inputs.push({candidate: feeTarget.candidate, credits: feeTargetCredits})
  inputs.sort((a, b) => compareAddresses(a.candidate, b.candidate))
  return inputs
}

function compareAddresses(a: PlatformSourceCandidate, b: PlatformSourceCandidate): number {
  const left = a.addressBytes
  const right = b.addressBytes
  const shared = Math.min(left.length, right.length)
  for (let i = 0; i < shared; i++) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return left.length - right.length
}

export function selectPlatformSource(
  candidates: PlatformSourceCandidate[],
  amountCredits: bigint,
  feeCredits: bigint,
  fromAddress?: string,
): PlatformSourceCandidate {
  if (amountCredits < MIN_OUTPUT_CREDITS) {
    throw new Error(`Minimum Platform transfer is ${MIN_OUTPUT_CREDITS.toString()} credits`)
  }

  const required = amountCredits + feeCredits

  if (fromAddress != null) {
    const chosen = candidates.find(candidate => candidate.platformAddress === fromAddress)
    if (chosen == null) {
      throw new Error('Source address not found in this wallet')
    }
    if (chosen.balanceCredits < required) {
      throw new Error('Source address has insufficient credits for this transfer plus fee')
    }
    return chosen
  }

  const funded = candidates.filter(candidate => candidate.balanceCredits >= required)
  if (funded.length === 0) {
    throw new Error('No Platform address holds enough credits for this transfer plus fee')
  }

  return funded.reduce((best, candidate) =>
    candidate.balanceCredits > best.balanceCredits ? candidate : best,
  )
}
