import { ConnectionType } from '@renderer/api/types'

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  p2p: 'Dash P2P',
  rpc: 'Dash Insight API',
}

export const SYNC_ACTION_LABELS = {
  start: 'Start sync',
  stop: 'Stop sync',
} as const

export const DATA_SOURCE_LABELS = {
  p2p: 'Local P2P',
  p2pSyncing: 'Local P2P (syncing)',
  rpc: 'Insight API',
  unknown: '—',
} as const

export const PARTIAL_DATA_NOTICE = 'Syncing over P2P — data may be incomplete'

export const CONNECTION_SWITCH_FAILED = 'Failed to switch connection mode'
