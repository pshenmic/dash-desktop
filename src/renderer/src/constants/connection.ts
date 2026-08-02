import { ConnectionType } from '@renderer/api/types'

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  p2p: 'Dash P2P',
  rpc: 'Dash Insight API',
}

export const SYNC_ACTION_LABELS = {
  start: 'Start sync',
  stop: 'Stop sync',
} as const

export const REFRESH_DATA_LABEL = 'Refresh data'

export const REFRESH_FAILED_MESSAGE = '**Refresh incomplete** Some data could not be refreshed.'
