export interface SyncProgressPhaseInfo {
  label: string
  progress: number
  current: number
  total: number
}

export type RpcHealthStatus = 'checking' | 'connected' | 'unavailable'

export type WalletSyncAction = 'start' | 'stop'
