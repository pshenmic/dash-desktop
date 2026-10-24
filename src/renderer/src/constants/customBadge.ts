import type { CustomBadgeColors, CustomBadgeVariant } from '@renderer/types/CustomBadge'

export const CUSTOM_BADGE_VARIANTS: Record<CustomBadgeVariant, CustomBadgeColors> = {
  default: { variant: 'flat', colorLight: 'blue', colorDark: 'turquoise' },
  error: { variant: 'flat', color: 'red' },
  muted: { variant: 'flat', colorLight: 'gray', colorDark: 'white' },
  accent: { variant: 'default', colorLight: 'blue', colorDark: 'turquoise', className: 'bg-dash-brand/10 dark:bg-dash-mint/5' },
  warning: { variant: 'flat', color: 'orange' },
}
