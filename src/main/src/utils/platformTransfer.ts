import {PlatformInputPlan, PlatformInputSelection, PlatformSourceCandidate} from '../types/PlatformTransfer'
import {MAX_ADDRESS_INPUTS, MIN_INPUT_CREDITS, MIN_OUTPUT_CREDITS} from '../constants'

export function identityTransferFeeCredits(recipientCount: number): bigint {
  return 500_000n + 6_000_000n * BigInt(recipientCount)
}

export function identityCreateFeeCredits(publicKeyCount: number): bigint {
  return 2_000_000n + 6_500_000n * BigInt(publicKeyCount)
}

export function topUpFeeCredits(inputCount: number): bigint {
  return 500_000n + 500_000n * BigInt(inputCount)
}

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

  const sorted = [...candidates].sort((a, b) =>
    a.balanceCredits === b.balanceCredits ? 0 : a.balanceCredits > b.balanceCredits ? -1 : 1,
  )

  const inputs: PlatformInputSelection[] = []
  let remaining = amountCredits

  for (const candidate of sorted) {
    if (remaining === 0n || inputs.length === MAX_ADDRESS_INPUTS) break

    const usable = inputs.length === 0
      ? candidate.balanceCredits - feeCredits
      : candidate.balanceCredits
    if (usable < MIN_INPUT_CREDITS) continue

    let credits = usable < remaining ? usable : remaining
    if (credits < remaining && remaining - credits < MIN_INPUT_CREDITS) {
      credits = remaining - MIN_INPUT_CREDITS
    }
    if (credits < MIN_INPUT_CREDITS) continue

    inputs.push({candidate, credits})
    remaining -= credits
  }

  if (remaining > 0n) {
    throw new Error('Platform addresses do not hold enough credits for this amount plus fee')
  }

  return {inputs, feeCredits}
}

export function selectPlatformInputsWithFee(
  candidates: PlatformSourceCandidate[],
  amountCredits: bigint,
  feeForInputCount: (inputCount: number) => bigint,
  preferredAddress?: string,
): PlatformInputPlan {
  let inputCount = 1
  for (;;) {
    const plan = selectPlatformInputs(candidates, amountCredits, feeForInputCount(inputCount), preferredAddress)
    if (plan.inputs.length <= inputCount) {
      return plan
    }
    inputCount = plan.inputs.length
  }
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
