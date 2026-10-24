import { SendLockPhase } from '../enums/SendLockPhase'
import { TransferOperation } from '../enums/TransferOperation'
import { operationInfo } from '../utils/transferMatrix'
import { SHIELDED_PROVING_LABEL } from './shieldedProgress'

export const SEND_LOCK_PHASE_COPY: Record<SendLockPhase, string> = {
  [SendLockPhase.Waiting]: 'Waiting for InstantSend confirmation…',
  [SendLockPhase.Fallback]: 'Waiting for block confirmation (a few minutes)…',
  [SendLockPhase.Instant]: 'Final · InstantSend',
  [SendLockPhase.Chainlocked]: 'Final · ChainLock',
  [SendLockPhase.Confirmed]: 'In a block',
}

export const SEND_PROGRESS_TITLE = operationInfo(TransferOperation.CoreSend).title

export const SHIELD_PROGRESS_TITLE = operationInfo(TransferOperation.Shield).title

export const SEND_BROADCASTING_LABEL = 'Broadcasting transaction…'

export const SHIELD_PROVING_PENDING_LABEL = `${SHIELDED_PROVING_LABEL}…`

export const SEND_INPUTS_CHANGED_MESSAGE = 'Transaction details changed. Review them and send again.'
