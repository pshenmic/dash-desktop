import type { ConnectionType, WalletSyncPhase, WalletSyncStatus } from '@renderer/api/types'

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

export type WalletSyncAction = 'start' | 'stop'

export type ConnectionSettingsTab = 'core' | 'platform'

export interface ConnectionSettingsTabDefinition {
  value: ConnectionSettingsTab
  label: string
}

export type WalletConnectionMode = ConnectionType

export type PeerTableTab = 'active' | 'banned' | 'static'

export interface PeerTableTabDefinition {
  value: PeerTableTab
  label: string
}

export interface PeerTableRow {
  id: string
  peer: string
  userAgent: string
  pingTime: string
}

export interface ConnectionSelectOption {
  value: string
  label: string
}

export interface ConnectionModeDetails {
  title: string
  highlight: string
  description: string
  timing: string
}
