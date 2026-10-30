import { SIMPLE_SEND_LABELS, SIMPLE_SEND_PROVER_ERROR } from '../constants/simpleSend'
import { ShieldedProverState } from '../enums/ShieldedProverState'
import type { SimpleSendSubmitInput, SimpleSendSubmitState } from '../types/SimpleSend'
import { requiresShieldedProver } from './transferMatrix'

export function simpleSendSubmit({ operation, sourceValid, password, verifying, prover }: SimpleSendSubmitInput): SimpleSendSubmitState {
  const needsProver = operation != null && requiresShieldedProver(operation)
  const proverFailed = needsProver && prover.prover === ShieldedProverState.Error
  const proverPending = needsProver && !prover.ready

  let label = SIMPLE_SEND_LABELS.send
  if (verifying) label = SIMPLE_SEND_LABELS.verifying
  else if (proverPending && !proverFailed) label = SIMPLE_SEND_LABELS.preparing

  return {
    ready: sourceValid && password.length > 0 && !verifying && !proverPending,
    label,
    proverError: proverFailed ? `${SIMPLE_SEND_PROVER_ERROR.prefix} ${prover.error ?? SIMPLE_SEND_PROVER_ERROR.unknown}` : null,
  }
}
