import { StatusPillTone } from '@renderer/enums/StatusPillTone'

export const STATUS_PILL_BASE = 'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1'

export const STATUS_PILL_TONES: Record<StatusPillTone, string> = {
  [StatusPillTone.Success]: 'bg-dash-green-15 text-dash-green!',
  [StatusPillTone.Warning]: 'bg-dash-orange/10 text-dash-orange!',
  [StatusPillTone.Danger]: 'bg-dash-red-15 text-dash-red!',
  [StatusPillTone.Inactive]: 'bg-dash-primary-dark-blue/8 text-dash-primary-dark-blue/50 dark:bg-white/8 dark:text-white/50',
  [StatusPillTone.Accent]: 'dash-block-accent-10 text-dash-brand! dark:text-dash-mint!',
}
