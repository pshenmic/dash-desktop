import {AssetLockFundingKind} from '../database/AssetLockDAO'

export type AssetLockFundingPhase =
  | 'idle'
  | 'resumable'
  | 'building'
  | 'broadcastingL1'
  | 'waitingChainLock'
  | 'broadcastingST'
  | 'done'
  | 'error'

export interface AssetLockFundingState {
  phase: AssetLockFundingPhase
  kind: AssetLockFundingKind
  txid: string | null
  txHeight: number | null
  chainLockedHeight: number | null
  lockKind: 'instant' | 'chain' | null
  stHash: string | null
  toPlatformAddress: string | null
  identityIdentifier: string | null
  amountDuffs: string | null
  error: string | null
}
