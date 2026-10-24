import { DASHPAY_IDENTITY_STORAGE_PREFIX } from '@renderer/constants/dashPay'

function storageKey(walletId: string): string {
  return `${DASHPAY_IDENTITY_STORAGE_PREFIX}${walletId}`
}

export function readStoredIdentity(walletId: string): string | null {
  try {
    return localStorage.getItem(storageKey(walletId)) || null
  } catch {
    return null
  }
}

export function writeStoredIdentity(walletId: string, identifier: string): void {
  try {
    localStorage.setItem(storageKey(walletId), identifier)
  } catch {
    return
  }
}
