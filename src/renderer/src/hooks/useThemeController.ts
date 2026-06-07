import { useEffect, useSyncExternalStore } from 'react'
import { useTheme } from 'dash-ui-kit/react'
import {
  ThemePreference,
  ResolvedTheme,
  readThemePreference,
  writeThemePreference,
  resolveTheme,
  systemPrefersDark,
} from '@renderer/utils/theme'

let preference: ThemePreference = readThemePreference()
let sysDark: boolean = systemPrefersDark()
let listeners: Array<() => void> = []
let mediaBound = false

function emit(): void {
  for (const l of [...listeners]) l()
}

function bindMedia(): void {
  if (mediaBound) return
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', (e) => {
      sysDark = e.matches
      emit()
    })
    mediaBound = true
  } catch {
    return
  }
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  bindMedia()
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getPreferenceSnapshot(): ThemePreference {
  return preference
}

function getResolvedSnapshot(): ResolvedTheme {
  return resolveTheme(preference, sysDark)
}

export function setThemePreference(next: ThemePreference): void {
  preference = next
  writeThemePreference(next)
  emit()
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getPreferenceSnapshot)
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, getResolvedSnapshot)
}

export function ThemeController(): null {
  const resolved = useResolvedTheme()
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme(resolved)
  }, [resolved, setTheme])

  return null
}
