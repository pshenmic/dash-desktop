import { ConnectionType } from '@renderer/api/types'

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  p2p: 'Dash P2P',
  rpc: 'Dashscan API',
}

export const SYNC_ACTION_LABELS = {
  start: 'Start sync',
  stop: 'Stop sync',
} as const

export const REFRESH_DATA_LABEL = 'Refresh data'

export const REFRESH_FAILED_MESSAGE = '**Refresh incomplete** Some data could not be refreshed.'

export const CONNECTION_SETTINGS_TABS = [
  { value: 'core', label: 'Core' },
  { value: 'platform', label: 'Platform' },
] as const

export const RPC_CONNECTION_NAME = 'dashscan.io'

export const SYNC_PROGRESS_COMPLETE_HOLD_MS = 500

export const SYNC_PROGRESS_FADE_MS = 300
