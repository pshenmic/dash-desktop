import type { WalletSyncPhase, WalletSyncStatus } from '@renderer/api/types'

export interface SyncProgressPhaseInfo {
  label: string
  caption: string
  progress: number
  current: number
  total: number
}

export interface SyncProgressTooltipProps {
  sync: WalletSyncStatus | undefined
  phase: WalletSyncPhase
  info: SyncProgressPhaseInfo
  percent: number
}

export type RpcHealthStatus = 'checking' | 'connected' | 'unavailable'

export type WalletSyncAction = 'start' | 'stop'
