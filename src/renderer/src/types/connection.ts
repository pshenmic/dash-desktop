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
  tooltipId: string
  variant: 'floating' | 'compact'
}

export interface SyncProgressBarProps {
  variant?: 'floating' | 'compact'
}

export type WalletSyncAction = 'start' | 'stop'
