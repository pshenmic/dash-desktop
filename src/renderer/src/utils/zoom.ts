export type ZoomPreference = '90' | '100' | '110' | '125' | '150'

export const ZOOM_STORAGE_KEY = 'wallet.zoom.preference'

export const DEFAULT_ZOOM: ZoomPreference = '100'

export const ZOOM_PRESETS: readonly ZoomPreference[] = ['90', '100', '110', '125', '150']

const ZOOM_PERCENT_BASE = 100

export function isZoomPreference(value: unknown): value is ZoomPreference {
  return typeof value === 'string' && ZOOM_PRESETS.includes(value as ZoomPreference)
}

export function readZoomPreference(): ZoomPreference {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY)
    return isZoomPreference(raw) ? raw : DEFAULT_ZOOM
  } catch {
    return DEFAULT_ZOOM
  }
}

export function writeZoomPreference(preference: ZoomPreference): void {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, preference)
  } catch {
    return
  }
}

export function zoomFactor(preference: ZoomPreference): number {
  return Number(preference) / ZOOM_PERCENT_BASE
}
