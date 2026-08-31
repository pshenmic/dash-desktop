import {FeeStrategyStep, PlatformFeeStep, PlatformInputSelection} from '../types/PlatformTransfer'
import {MAX_FEE_STRATEGY_STEPS} from '../constants/credits'

// What every address-funded transition has always sent: the fee comes off
// index 0, which consensus resolves against the byte-sorted inputs.
export const DEDUCT_FROM_FIRST_INPUT: FeeStrategyStep[] = [{kind: 'deductFromInput', index: 0}]

export type FeeStrategyOutcome =
  | {steps: FeeStrategyStep[]; error: null}
  | {steps: null; error: string}

// Outputs are counted rather than named: an operation whose funding has no
// address output refuses a reduceOutput step instead of guessing its index.
export function resolveFeeStrategy(
  steps: PlatformFeeStep[],
  inputs: PlatformInputSelection[],
  outputCount: number,
): FeeStrategyOutcome {
  if (steps.length === 0) {
    return {steps: null, error: 'Fee strategy must name who pays the fee'}
  }
  if (steps.length > MAX_FEE_STRATEGY_STEPS) {
    return {steps: null, error: `A transition takes at most ${MAX_FEE_STRATEGY_STEPS} fee strategy steps`}
  }

  const resolved: FeeStrategyStep[] = []
  for (const step of steps) {
    if (step.kind === 'reduceOutput') {
      if (step.index < 0 || step.index >= outputCount) {
        return {steps: null, error: 'This operation has no output the fee can be taken from'}
      }
      resolved.push(step)
      continue
    }

    const index = inputs.findIndex(input => input.candidate.platformAddress === step.address)
    if (index === -1) {
      return {steps: null, error: 'The address paying the fee is not one of the inputs'}
    }
    resolved.push({kind: 'deductFromInput', index})
  }

  const targets = new Set(resolved.map(step => `${step.kind}:${step.index}`))
  if (targets.size !== resolved.length) {
    return {steps: null, error: 'Fee strategy charges the same input or output twice'}
  }
  return {steps: resolved, error: null}
}
