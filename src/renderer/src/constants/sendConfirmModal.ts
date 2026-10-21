import { SendLockPhase } from '../enums/SendLockPhase'

export const SEND_LOCK_PHASE_COPY: Record<SendLockPhase, string> = {
  [SendLockPhase.Waiting]: 'Waiting for InstantSend confirmation…',
  [SendLockPhase.Fallback]: 'Waiting for block confirmation (a few minutes)…',
  [SendLockPhase.Instant]: 'Final · InstantSend',
  [SendLockPhase.Chainlocked]: 'Final · ChainLock',
  [SendLockPhase.Confirmed]: 'In a block',
}
