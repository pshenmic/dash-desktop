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
