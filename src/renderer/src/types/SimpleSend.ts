import type { ShieldedStatus } from '../api/types'
import type { TransferOperation } from '../enums/TransferOperation'

export interface SimpleSendSubmitInput {
  operation: TransferOperation | null
  sourceValid: boolean
  password: string
  verifying: boolean
  prover: ShieldedStatus
}

export interface SimpleSendSubmitState {
  ready: boolean
  label: string
  proverError: string | null
}
