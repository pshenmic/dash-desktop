import {PlatformInputPlan, PlatformInputSelection, PlatformSourceCandidate} from '../types/PlatformTransfer'
import {AddressInput} from '../../platform/types/messages'
import {MAX_ADDRESS_INPUTS, MIN_INPUT_CREDITS, MIN_OUTPUT_CREDITS} from '../constants'

export function toAddressInput(candidate: PlatformSourceCandidate, credits: bigint): AddressInput {
  return {
    platformAddress: candidate.platformAddress,
    index: candidate.index,
    nonce: candidate.nonce,
    credits,
  }
}

// Consensus takes the fee from the remaining balance of the input its
// DeductFromInput(0) resolves to, which is whichever address sorts first.
export function selectPlatformInputs(
  candidates: PlatformSourceCandidate[],
  amountCredits: bigint,
  feeCredits: bigint,
  preferredAddress?: string,
): PlatformInputPlan {
  if (amountCredits < MIN_INPUT_CREDITS) {
    throw new Error(`Minimum amount is ${MIN_INPUT_CREDITS.toString()} credits`)
  }

  if (preferredAddress != null) {
    const chosen = candidates.find(candidate => candidate.platformAddress === preferredAddress)
    if (chosen == null) {
      throw new Error('Source address not found in this wallet')
    }
    if (chosen.balanceCredits < amountCredits + feeCredits) {
      throw new Error('Source address has insufficient credits for this amount plus fee')
    }
    return {inputs: [{candidate: chosen, credits: amountCredits}], feeCredits}
  }

  const sorted = [...candidates]
    .filter(candidate => candidate.balanceCredits >= MIN_INPUT_CREDITS)
    .sort((a, b) => (a.balanceCredits === b.balanceCredits ? 0 : a.balanceCredits > b.balanceCredits ? -1 : 1))

  const prefix: PlatformSourceCandidate[] = []
  let accumulated = 0n

  for (const candidate of sorted) {
    if (prefix.length === MAX_ADDRESS_INPUTS) break

    prefix.push(candidate)
    accumulated += candidate.balanceCredits
    if (accumulated < amountCredits + feeCredits) continue

    const plan = planAroundFeeTarget(prefix, accumulated, amountCredits, feeCredits)
    if (plan !== null) return plan
  }

  if (accumulated < amountCredits + feeCredits) {
    throw new Error('Platform addresses do not hold enough credits for this amount plus fee')
  }
  throw new Error(
    'No combination of addresses leaves the fee-paying address enough remaining credits; '
    + 'consolidate funds into fewer addresses and try again',
  )
}

// The fee scales with the input count, and covering a larger fee can pull in
// another input, so re-select until the count the fee was quoted for holds.
export async function selectPlatformInputsWithFee(
  candidates: PlatformSourceCandidate[],
  amountCredits: bigint,
  feeForInputCount: (inputCount: number) => Promise<bigint>,
  preferredAddress?: string,
): Promise<PlatformInputPlan> {
  let inputCount = 1
  for (;;) {
    const plan = selectPlatformInputs(candidates, amountCredits, await feeForInputCount(inputCount), preferredAddress)
    if (plan.inputs.length <= inputCount) {
      return plan
    }
    inputCount = plan.inputs.length
  }
}

// Loads the fee-paying address as lightly as its peers allow, so what it keeps
// back covers the fee. Null means this prefix cannot, so widen it.
function planAroundFeeTarget(
  prefix: PlatformSourceCandidate[],
  accumulated: bigint,
  amountCredits: bigint,
  feeCredits: bigint,
): PlatformInputPlan | null {
  const feeTarget = prefix.reduce((first, candidate) =>
    compareAddresses(candidate, first) < 0 ? candidate : first,
  )

  const feeTargetMax = feeTarget.balanceCredits - feeCredits
  if (feeTargetMax < MIN_INPUT_CREDITS) return null

  const peersTotal = accumulated - feeTarget.balanceCredits
  const shortfall = amountCredits - peersTotal
  const feeTargetMin = shortfall > MIN_INPUT_CREDITS ? shortfall : MIN_INPUT_CREDITS
  if (feeTargetMin > feeTargetMax) return null

  const inputs: PlatformInputSelection[] = []
  let remaining = amountCredits - feeTargetMin

  for (const candidate of prefix) {
    if (candidate === feeTarget || remaining === 0n) continue
    const credits = candidate.balanceCredits < remaining ? candidate.balanceCredits : remaining
    // A share below the protocol minimum cannot be its own input; the fee
    // target carries it instead.
    if (credits < MIN_INPUT_CREDITS) continue
    inputs.push({candidate, credits})
    remaining -= credits
  }

  const feeTargetCredits = feeTargetMin + remaining
  if (feeTargetCredits > feeTargetMax) return null

  inputs.push({candidate: feeTarget, credits: feeTargetCredits})
  inputs.sort((a, b) => compareAddresses(a.candidate, b.candidate))
  return {inputs, feeCredits}
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
