import { AssetLockLockStep } from '../enums/AssetLockLockStep'
import { LockKind } from '../enums/LockKind'

export function assetLockLockStep(lockKind: LockKind | null, active: boolean, chainLockFallback: boolean): AssetLockLockStep {
  if (lockKind === LockKind.Instant) return AssetLockLockStep.InstantLocked
  if (lockKind === LockKind.Chain) return AssetLockLockStep.ChainLocked
  if (!active) return AssetLockLockStep.Pending
  return chainLockFallback ? AssetLockLockStep.WaitingChainLock : AssetLockLockStep.WaitingInstantLock
}
