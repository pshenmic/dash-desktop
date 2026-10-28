import { TRANSFER_WIZARD_LABELS } from './transferWizard'

export const SIMPLE_SEND_PASSWORD_ID = 'simple-send-password'

export const SIMPLE_SEND_LABELS = {
  send: TRANSFER_WIZARD_LABELS.submit,
  verifying: 'Verifying…',
  preparing: 'Preparing…',
  retryFee: 'Retry fee estimate',
}

export const SIMPLE_SEND_PROVER_ERROR = {
  prefix: "Couldn't prepare the private transaction:",
  unknown: 'unknown error',
}
