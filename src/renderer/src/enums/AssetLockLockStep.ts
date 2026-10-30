export enum AssetLockLockStep {
  Pending = 'pending',
  WaitingInstantLock = 'waitingInstantLock',
  WaitingChainLock = 'waitingChainLock',
  InstantLocked = 'instantLocked',
  ChainLocked = 'chainLocked',
}
