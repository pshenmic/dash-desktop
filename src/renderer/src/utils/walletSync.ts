import {ConnectionType, WalletSyncPhase} from '@renderer/api/types'

export function isWalletSyncInactive(phase: WalletSyncPhase | undefined): boolean {
  return phase === undefined || phase === WalletSyncPhase.Stopped || phase === WalletSyncPhase.Idle
}

export function shouldShowWalletSyncUI(phase: WalletSyncPhase | undefined): boolean {
  return !isWalletSyncInactive(phase)
}

export function isWalletSyncIncomplete(
  connectionType: ConnectionType,
  phase: WalletSyncPhase | undefined,
): boolean {
  return connectionType === 'p2p' && phase !== WalletSyncPhase.Synced
}

export function formatSyncEta(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
