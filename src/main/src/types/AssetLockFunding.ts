import {AssetLockFundingKind} from '../enums/AssetLockFundingKind'
import {AssetLockFundingPhase} from '../enums/AssetLockFundingPhase'
import {LockKind} from '../enums/LockKind'

export {AssetLockFundingKind, AssetLockFundingPhase, LockKind}

export interface AssetLockFundingState {
  phase: AssetLockFundingPhase
  kind: AssetLockFundingKind
  txid: string | null
  txHeight: number | null
  chainLockedHeight: number | null
  lockKind: LockKind | null
  stHash: string | null
  toPlatformAddress: string | null
  identityIdentifier: string | null
  amountDuffs: string | null
  error: string | null
}
