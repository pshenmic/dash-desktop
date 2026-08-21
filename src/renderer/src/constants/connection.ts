import { ConnectionStatus, ConnectionType, WalletSyncPhase } from '@renderer/api/types'

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  p2p: 'Dash P2P',
  rpc: 'Dashscan API',
}

export const CONNECTION_STATUS_DISPLAY: Record<ConnectionStatus, {
  label: string
  textColor: string
  shadowColor: string
}> = {
  connecting: {
    label: 'Connecting',
    textColor: 'text-dash-orange!',
    shadowColor: 'var(--color-dash-orange)',
  },
  connected: {
    label: 'Connected',
    textColor: 'text-dash-mint!',
    shadowColor: 'var(--color-dash-mint)',
  },
  unavailable: {
    label: 'Unavailable',
    textColor: 'text-dash-orange!',
    shadowColor: 'var(--color-dash-orange)',
  },
  synced: {
    label: 'Synced',
    textColor: 'text-dash-mint!',
    shadowColor: 'var(--color-dash-mint)',
  },
  syncing: {
    label: 'Syncing',
    textColor: 'text-dash-orange!',
    shadowColor: 'var(--color-dash-orange)',
  },
  'sync-stopped': {
    label: 'Sync stopped',
    textColor: 'text-dash-orange!',
    shadowColor: 'var(--color-dash-orange)',
  },
}

export const SYNC_ACTION_LABELS = {
  start: 'Start sync',
  stop: 'Stop sync',
} as const

export const WALLET_SYNC_PHASE_LABELS: Record<WalletSyncPhase, string> = {
  [WalletSyncPhase.Idle]: 'Idle',
  [WalletSyncPhase.Connecting]: 'Connecting',
  [WalletSyncPhase.SyncingHeaders]: 'Syncing headers',
  [WalletSyncPhase.SyncedHeaders]: 'Headers synchronized',
  [WalletSyncPhase.SyncingCfcheckpt]: 'Syncing filter checkpoints',
  [WalletSyncPhase.SyncingCfheaders]: 'Syncing filter headers',
  [WalletSyncPhase.SyncingCfilters]: 'Scanning wallet data',
  [WalletSyncPhase.Synced]: 'Synchronized',
  [WalletSyncPhase.Stopped]: 'Stopped',
}

export const REFRESH_DATA_LABEL = 'Refresh data'

export const REFRESH_FAILED_MESSAGE = '**Refresh incomplete** Some data could not be refreshed.'

export const RPC_CONNECTION_NAME = 'dashscan.io'

export const SYNC_PROGRESS_COMPLETE_HOLD_MS = 500

export const SYNC_PROGRESS_FADE_MS = 300
