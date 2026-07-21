export enum AssetLockFundingPhase {
  Idle = 'idle',
  Resumable = 'resumable',
  Building = 'building',
  BroadcastingL1 = 'broadcastingL1',
  WaitingChainLock = 'waitingChainLock',
  BroadcastingST = 'broadcastingST',
  Done = 'done',
  Error = 'error',
}
