import packageJSON from '../../../../package.json'
import type { SegmentOption } from '@renderer/components/ui/SegmentedControl'
import type { ThemePreference } from '@renderer/utils/theme'
import { ZOOM_PRESETS, type ZoomPreference } from '@renderer/utils/zoom'

export const SETTINGS_HUB_SECTIONS = [
  {
    label: 'Wallet Settings',
    items: [
      { title: 'General', to: '/settings/general', icon: 'general' },
      { title: 'Preferences', to: '/settings/preferences', icon: 'preferences' },
      { title: 'P2P Connection', to: '/connection-settings', icon: 'connection' },
      { title: 'Security & Privacy', to: '/settings/security', icon: 'security' },
    ],
  },
  {
    label: 'Other',
    items: [
      { title: 'About Dash Desktop Wallet', to: '/settings/about', icon: 'about' },
    ],
  },
] as const

export const THEME_OPTIONS: SegmentOption<ThemePreference>[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export const ZOOM_OPTIONS: SegmentOption<ZoomPreference>[] = ZOOM_PRESETS.map((value) => ({
  value,
  label: `${value}%`,
}))

export const CURRENCY_OPTIONS: SegmentOption<string>[] = [
  { value: 'usd', label: 'USD' },
  { value: 'eur', label: 'EUR' },
  { value: 'btc', label: 'BTC' },
  { value: 'rub', label: 'RUB' },
]

export const DEBUG_OPTIONS: SegmentOption<'off' | 'on'>[] = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
]

export const DASH_DESKTOP_VERSION = packageJSON.version
