import type { LogLevel } from '@renderer/api/types'
import type { ThemePreference } from '@renderer/utils/theme'
import { ZOOM_PRESETS, type ZoomPreference } from '@renderer/utils/zoom'

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export const ZOOM_OPTIONS: { value: ZoomPreference; label: string }[] = ZOOM_PRESETS.map((value) => ({
  value,
  label: `${value}%`,
}))

export const CURRENCY_OPTIONS = [
  { value: 'usd', label: 'USD' },
  { value: 'eur', label: 'EUR' },
  { value: 'btc', label: 'BTC' },
  { value: 'rub', label: 'RUB' },
]

export const ADVANCED_MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
]

export const LOG_LEVEL_OPTIONS: { value: LogLevel; label: string }[] = [
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warn' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
]
