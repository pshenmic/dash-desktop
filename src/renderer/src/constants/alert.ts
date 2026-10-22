import { AlertTone } from '../enums/AlertTone'
import type { AlertToneStyles } from '../types/Alert'

export const ALERT_TONE_STYLES: Record<AlertTone, AlertToneStyles> = {
  [AlertTone.Warning]: {
    surface: 'border-dash-orange/40 bg-dash-orange/8 dark:bg-dash-orange/10',
    accent: 'text-dash-orange',
    title: 'text-dash-orange!',
  },
  [AlertTone.Info]: {
    surface: 'border-dash-brand/40 bg-dash-brand/8 dark:border-dash-mint/40 dark:bg-dash-mint/10',
    accent: 'text-dash-brand dark:text-dash-mint',
    title: '',
  },
}
