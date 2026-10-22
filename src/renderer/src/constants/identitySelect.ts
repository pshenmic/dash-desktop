import { IdentitySelectAppearance } from '../enums/IdentitySelectAppearance'
import { ListNavigationKey } from '../enums/ListNavigationKey'
import type { IdentitySelectStyles } from '../types/IdentitySelect'

export const IDENTITY_SELECT_SEARCH_MIN = 6

export const IDENTITY_SELECT_NAVIGATION_KEYS: string[] = Object.values(ListNavigationKey)

export const IDENTITY_SELECT_HEADER_BASE = 'relative h-10 w-[17.5rem] flex items-center gap-2.5 rounded-[.875rem] dash-block dash-black-border pl-1.5 pr-3'

export const IDENTITY_SELECT_HEADER_SKELETON = 'h-10 w-[17.5rem] rounded-[.875rem] animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const IDENTITY_SELECT_STYLES: Record<IdentitySelectAppearance, IdentitySelectStyles> = {
  [IdentitySelectAppearance.Field]: {
    trigger: 'w-full h-[3.25rem] dash-block rounded-2xl px-4 flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity',
    popover: 'absolute left-0 right-0 top-[calc(100%+.375rem)] z-30',
    list: 'max-h-60 overflow-y-auto scrollbar-custom',
    option: 'w-full flex flex-col gap-0.5 text-left',
  },
  [IdentitySelectAppearance.Header]: {
    trigger: `${IDENTITY_SELECT_HEADER_BASE} cursor-pointer hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40`,
    popover: 'absolute right-0 top-[calc(100%+.375rem)] z-30 w-[22rem]',
    list: 'max-h-[20rem] overflow-y-auto scrollbar-custom',
    option: 'w-full grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 text-left',
  },
}

export const IDENTITY_SELECT_FRAME_CLASS = 'flex flex-col gap-1'

export const IDENTITY_SELECT_META_CLASS = 'block min-w-0 truncate text-[0.625rem] font-medium leading-[130%] text-dash-primary-dark-blue/50 dark:text-white/50'

export const IDENTITY_SELECT_DIVIDER_CLASS = 'h-px bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const IDENTITY_SELECT_COPY = {
  identities: 'Identities',
  empty: 'No identities in this wallet',
  loading: 'Loading identities',
  reload: 'Reload identities',
  select: 'Select identity',
  actAs: 'Act as',
  searchPlaceholder: 'Search name or ID',
  searchLabel: 'Search identities',
  actingIdentity: 'Acting identity',
  change: 'Change identity',
  attention: 'Other identities have requests',
  noMatch: 'No identities match',
} as const

export const ACTING_IDENTITY_CHIP_CLASS = 'h-8 max-w-48 flex items-center gap-2 rounded-[.75rem] dash-block dash-black-border pl-1 pr-2.5'

export const ACTING_IDENTITY_CHIP_COPY = {
  tooltip: 'Go back to switch identity',
  actingAs: 'Acting as',
} as const
