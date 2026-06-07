import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isThemePreference,
  resolveTheme,
  readThemePreference,
  writeThemePreference,
  THEME_STORAGE_KEY,
} from '../../src/renderer/src/utils/theme'

describe('isThemePreference', () => {
  it('accepts the three valid values', () => {
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isThemePreference('blue')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
    expect(isThemePreference(undefined)).toBe(false)
    expect(isThemePreference(5)).toBe(false)
  })
})

describe('resolveTheme', () => {
  it('returns the explicit preference regardless of system', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the system preference when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
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

  it('defaults to system when nothing is stored', () => {
    expect(readThemePreference()).toBe('system')
  })

  it('round-trips a written preference', () => {
    writeThemePreference('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(readThemePreference()).toBe('dark')
  })

  it('falls back to system for a corrupted stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'garbage')
    expect(readThemePreference()).toBe('system')
  })
})
