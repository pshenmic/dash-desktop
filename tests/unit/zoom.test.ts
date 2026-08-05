import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isZoomPreference,
  zoomFactor,
  readZoomPreference,
  writeZoomPreference,
  ZOOM_PRESETS,
  ZOOM_STORAGE_KEY,
  DEFAULT_ZOOM,
} from '../../src/renderer/src/utils/zoom'

describe('isZoomPreference', () => {
  it('accepts every preset', () => {
    for (const preset of ZOOM_PRESETS) {
      expect(isZoomPreference(preset)).toBe(true)
    }
  })

  it('rejects anything else', () => {
    expect(isZoomPreference('200')).toBe(false)
    expect(isZoomPreference('huge')).toBe(false)
    expect(isZoomPreference(null)).toBe(false)
    expect(isZoomPreference(undefined)).toBe(false)
    expect(isZoomPreference(100)).toBe(false)
  })
})

describe('zoomFactor', () => {
  it('converts percent presets to zoom factors', () => {
    expect(zoomFactor('90')).toBe(0.9)
    expect(zoomFactor('100')).toBe(1)
    expect(zoomFactor('125')).toBe(1.25)
    expect(zoomFactor('150')).toBe(1.5)
  })
})

describe('localStorage persistence', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    })
  })

  it('defaults to 100 when nothing is stored', () => {
    expect(readZoomPreference()).toBe(DEFAULT_ZOOM)
  })

  it('round-trips a written preference', () => {
    writeZoomPreference('125')
    expect(localStorage.getItem(ZOOM_STORAGE_KEY)).toBe('125')
    expect(readZoomPreference()).toBe('125')
  })

  it('falls back to 100 for a corrupted stored value', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, '9000')
    expect(readZoomPreference()).toBe(DEFAULT_ZOOM)
  })
})
