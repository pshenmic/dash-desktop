export const DEBUG_MODE_STORAGE_KEY = 'wallet.debug.enabled'

export function readDebugMode(): boolean {
  try {
    return localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function writeDebugMode(enabled: boolean): void {
  try {
    localStorage.setItem(DEBUG_MODE_STORAGE_KEY, String(enabled))
  } catch {
    return
  }
}
