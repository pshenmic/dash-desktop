import type {
  ConnectionType,
  DapiUrlStatus,
  Network,
  PeerInfo,
  PeerMode,
  WalletSyncPhase,
  WalletSyncStatus,
} from '@renderer/api/types'

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

export interface CompletedSyncSnapshot {
  walletId: string
  tipHeight: number
  cfilterScanHeight: number
}

export type WalletSyncAction = 'start' | 'stop'

export type ConnectionSettingsTab = 'core' | 'platform'

export interface ConnectionSettingsTabDefinition {
  value: ConnectionSettingsTab
  label: string
}

export type WalletConnectionMode = ConnectionType

export type PeerTableTab = 'active' | 'banned' | 'static'

export type PeerConfiguredList = 'dynamic' | 'static' | 'banned'

export type PeerMutation =
  | 'set-mode'
  | 'add-dynamic'
  | 'remove-dynamic'
  | 'add-static'
  | 'remove-static'
  | 'ban'
  | 'unban'

export type PeerRowAction = 'ban' | 'add-static' | 'remove-dynamic' | 'remove-static' | 'unban'

export interface PeerTableTabDefinition {
  value: PeerTableTab
  label: string
}

export interface PeerTableRow {
  id: string
  entry: string
  peer: string
  userAgent: string
  pingTime: string
  pool: string | null
  connected: boolean
  configuredList: PeerConfiguredList | null
}

export interface PeerTableSources {
  connectedPeers: PeerInfo[]
  dynamicPeers: string[]
  staticPeers: string[]
  bannedPeers: string[]
  network: Network
}

export interface UsePeerSettingsResult {
  configuredMode: PeerMode | null
  connectedPeers: PeerInfo[]
  dynamicPeers: string[]
  staticPeers: string[]
  bannedPeers: string[]
  loading: boolean
  connectedPeersLoading: boolean
  settingsReady: boolean
  pending: PeerMutation | null
  error: string | null
  clearError: () => void
  reload: () => void
  setMode: (mode: PeerMode) => Promise<void>
  addDynamicPeer: (peer: string) => Promise<boolean>
  removeDynamicPeer: (peer: string) => Promise<void>
  addStaticPeer: (peer: string) => Promise<boolean>
  removeStaticPeer: (peer: string) => Promise<void>
  banPeer: (peer: string) => Promise<boolean>
  unbanPeer: (peer: string) => Promise<void>
}

export interface ConnectionModeDetails {
  title: string
  highlight: string
  description: string
  timing: string
}

export type PlatformNodeMutation = 'set-mode' | 'save-nodes'

export interface UsePlatformNodeSettingsResult {
  configuredMode: PeerMode | null
  activeNodes: DapiUrlStatus[]
  staticNodes: string[]
  hasStaticNodes: boolean
  loading: boolean
  activeNodesLoading: boolean
  settingsReady: boolean
  pending: PlatformNodeMutation | null
  error: string | null
  activeNodesError: string | null
  reload: () => void
  setMode: (mode: PeerMode) => Promise<void>
  addStaticNode: (url: string) => Promise<boolean>
  removeStaticNode: (url: string) => Promise<void>
}

export interface ConnectionSectionTitleProps {
  label: string
  tooltip: string
  className?: string
}

export interface ConnectionSwitchProps {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: () => void
}

export interface ConnectionSettingsRowProps {
  label: string
  children: React.ReactNode
}
