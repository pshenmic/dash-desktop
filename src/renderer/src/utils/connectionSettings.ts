import type { ConnectionType } from '@renderer/api/types'
import {
  P2P_SWITCH_PROMPT_DISMISSED_STORAGE_PREFIX,
  WALLET_CONNECTION_MODES,
  WALLET_CONNECTION_MODE_STORAGE_KEY,
  WALLET_SYNC_ENABLED_STORAGE_KEY,
} from '@renderer/constants/connection'

export function readDesiredConnectionMode(): ConnectionType {
  const storedMode = localStorage.getItem(WALLET_CONNECTION_MODE_STORAGE_KEY)
  return WALLET_CONNECTION_MODES.includes(storedMode as ConnectionType)
    ? storedMode as ConnectionType
    : 'rpc'
}

export function isWalletSyncEnabled(): boolean {
  return localStorage.getItem(WALLET_SYNC_ENABLED_STORAGE_KEY) !== 'false'
}

export function setDesiredConnectionMode(mode: ConnectionType): void {
  localStorage.setItem(WALLET_CONNECTION_MODE_STORAGE_KEY, mode)
}

export function setWalletSyncEnabled(enabled: boolean): void {
  localStorage.setItem(WALLET_SYNC_ENABLED_STORAGE_KEY, String(enabled))
}

export function saveWalletConnectionSettings(
  mode: ConnectionType,
  syncEnabled: boolean,
): void {
  setDesiredConnectionMode(mode)
  setWalletSyncEnabled(syncEnabled)
}

function p2pSwitchPromptStorageKey(walletId: string): string {
  return `${P2P_SWITCH_PROMPT_DISMISSED_STORAGE_PREFIX}.${walletId}`
}

export function isP2pSwitchPromptDismissed(walletId: string): boolean {
  return localStorage.getItem(p2pSwitchPromptStorageKey(walletId)) === 'true'
}

export function dismissP2pSwitchPrompt(walletId: string): void {
  localStorage.setItem(p2pSwitchPromptStorageKey(walletId), 'true')
}
