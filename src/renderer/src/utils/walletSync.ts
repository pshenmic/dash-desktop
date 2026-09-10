import {ConnectionType, WalletSyncPhase, type WalletSyncStatus} from '@renderer/api/types'
import {SYNC_PROGRESS_BACKGROUND_MAX_NEW_BLOCKS} from '@renderer/constants/connection'
import type {CompletedSyncSnapshot} from '@renderer/types/connection'

export function isWalletSyncInactive(phase: WalletSyncPhase | undefined): boolean {
  return phase === undefined || phase === WalletSyncPhase.Stopped || phase === WalletSyncPhase.Idle
}

export function shouldShowWalletSyncUI(phase: WalletSyncPhase | undefined): boolean {
  return !isWalletSyncInactive(phase)
}

export function shouldSuppressNearTipSyncProgress(
  sync: WalletSyncStatus | undefined,
  completed: CompletedSyncSnapshot | null,
): boolean {
  if (
    sync === undefined
    || completed === null
    || sync.walletId !== completed.walletId
    || sync.phase !== WalletSyncPhase.SyncingCfilters
    || sync.lastError !== null
  ) return false

  const networkHeight = Math.max(sync.tipHeight, sync.estimatedChainHeight)
  return networkHeight - completed.tipHeight <= SYNC_PROGRESS_BACKGROUND_MAX_NEW_BLOCKS
    && sync.cfilterScanHeight >= completed.cfilterScanHeight
}

export function isWalletSyncIncomplete(
  connectionType: ConnectionType,
  phase: WalletSyncPhase | undefined,
): boolean {
  return connectionType === 'p2p' && phase !== WalletSyncPhase.Synced
}

export function shouldShowWalletSyncWarning(
  connectionType: ConnectionType,
  sync: WalletSyncStatus | undefined,
  completed: CompletedSyncSnapshot | null,
): boolean {
  return isWalletSyncIncomplete(connectionType, sync?.phase)
    && !shouldSuppressNearTipSyncProgress(sync, completed)
}

export function shouldOfferP2pSwitch(
  connectionType: ConnectionType,
  phase: WalletSyncPhase | undefined,
  syncWalletId: string | null | undefined,
  selectedWalletId: string | null | undefined,
  dismissed: boolean,
): boolean {
  return connectionType === 'rpc'
    && phase === WalletSyncPhase.Synced
    && selectedWalletId !== null
    && selectedWalletId !== undefined
    && syncWalletId === selectedWalletId
    && !dismissed
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
