import { PROVER_ERROR_PREVIEW_LENGTH, PROVER_PILL_TEXTS } from '@renderer/constants/shielded'

export function proverFailureLabel(error: string | null): string {
  if (error === null) return `${PROVER_PILL_TEXTS.failed}: ${PROVER_PILL_TEXTS.unknownError}`
  const preview = error.length > PROVER_ERROR_PREVIEW_LENGTH ? `${error.slice(0, PROVER_ERROR_PREVIEW_LENGTH)}…` : error
  return `${PROVER_PILL_TEXTS.failed}: ${preview}`
}
