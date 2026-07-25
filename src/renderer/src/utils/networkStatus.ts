import { ConnectionType, WalletSyncStatus } from '@renderer/api/types'
import { WalletSyncPhase } from '../enums/WalletSyncPhase'

export type NetworkStatusTone = 'ok' | 'busy' | 'warn'

export interface NetworkStatusInfo {
  label: string
  tone: NetworkStatusTone
}

export function describeNetworkStatus(sync: WalletSyncStatus | undefined): NetworkStatusInfo {
  if (!sync) return { label: 'Operational', tone: 'ok' }
  if (sync.lastError) return { label: 'Degraded', tone: 'warn' }
  switch (sync.phase) {
    case 'synced':
    case 'stopped':
    case 'idle':
      return { label: 'Operational', tone: 'ok' }
    default:
      return { label: 'Syncing', tone: 'busy' }
  }
}

export function describeDataSource(desired: ConnectionType, phase: WalletSyncPhase | undefined): string {
  return desired === 'p2p' && phase === WalletSyncPhase.Synced ? 'Local P2P' : 'Insight API'
}

export function formatChange24h(change: number): string {
  const abs = Math.abs(change)
  return `${change < 0 ? '↓' : '↑'}${abs.toFixed(2)}%`
}
