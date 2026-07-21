export enum WalletSyncPhase {
  Idle = 'idle',
  Connecting = 'connecting',
  SyncingHeaders = 'syncing-headers',
  SyncedHeaders = 'synced-headers',
  SyncingCfcheckpt = 'syncing-cfcheckpt',
  SyncingCfheaders = 'syncing-cfheaders',
  SyncingCfilters = 'syncing-cfilters',
  Synced = 'synced',
  Stopped = 'stopped',
}
