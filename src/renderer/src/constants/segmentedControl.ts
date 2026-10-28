import { SegmentedControlAppearance } from '../enums/SegmentedControlAppearance'
import type { SegmentedControlAppearanceStyles } from '../types/SegmentedControl'

export const SEGMENTED_CONTROL_APPEARANCE_STYLES: Record<SegmentedControlAppearance, SegmentedControlAppearanceStyles> = {
  [SegmentedControlAppearance.Boxed]: {
    group: 'gap-1 p-1 rounded-[.75rem] bg-dash-control-background dark:bg-white/3 dash-black-border',
    option: 'px-3.5 py-1.5 rounded-[.5rem] transition-colors duration-150',
    active: 'bg-dash-brand dark:bg-dash-mint/20',
    inactive: 'hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5',
    textSize: 12,
    textColor: 'default',
    activeText: 'text-white! dark:text-dash-mint!',
    inactiveText: 'dash-text-default',
  },
  [SegmentedControlAppearance.Pill]: {
    group: 'gap-1',
    option: 'h-9 rounded-full px-4 transition-[background-color,opacity] duration-150',
    active: 'dash-block-5',
    inactive: 'opacity-30 hover:opacity-100',
    textSize: 14,
    textColor: 'brand',
    activeText: '',
    inactiveText: '',
  },
}
