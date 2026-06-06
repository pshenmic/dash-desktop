import { ConnectionType } from '@renderer/api/types'

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  p2p: 'Dash P2P',
  rpc: 'Dash Insight API',
}

export const CONNECTION_DESCRIPTIONS: Record<ConnectionType, string> = {
  p2p: 'Local p2p node',
  rpc: 'Public REST API',
}

export const P2P_FALLBACK_DESCRIPTION = 'Waiting for sync — using Insight'

export const SYNC_ACTION_LABELS = {
  start: 'Start sync',
  stop: 'Stop sync',
  restart: 'Restart sync',
} as const
