import { DashPayTab, SearchResultState } from '@renderer/enums/DashPay'
import type { SearchResultBadge } from '@renderer/types/DashPayAddContact'
import { USERNAME_SEARCH_RESULT_CAP, DASHPAY_PARAMS, DASHPAY_ROUTES } from './dashPay'
import { CHIP_ACTION, SURFACE_ROW } from './surfaces'

export const ADD_CONTACT_COPY = {
  find: 'Find',
  confirm: 'Confirm',
  submit: 'Send request',
  fromIdentity: 'From identity',
  searchPlaceholder: 'Username or identity ID',
  searchLabel: 'Search usernames or paste an identity ID',
  idle: 'Type a username, or paste an identity ID.',
  resultsFor: 'Results for',
  resultsLabel: 'Search results',
  noMatch: 'No usernames start with',
  capped: `Showing first ${USERNAME_SEARCH_RESULT_CAP} — refine your search`,
  noUsername: 'No username',
  open: 'Open',
  accept: 'Accept',
  enableFirst: 'Enable DashPay first',
  from: 'From',
  to: 'To',
  fee: 'Fee',
  identityBalance: 'Identity balance',
  balanceAfter: 'Balance after',
  note: 'Contact requests are public; payment details stay encrypted.',
  modalTitle: 'Send contact request',
  pending: 'Sending request…',
  doneHeadline: 'Request sent to',
  doneNoteLead: 'Once',
  doneNoteTail: 'accepts, you can pay them by username.',
  noIdentities: 'No identities in this wallet',
} as const

export const ADD_CONTACT_FALLBACK_RETURN = `${DASHPAY_ROUTES.root}?${DASHPAY_PARAMS.tab}=${DashPayTab.Contacts}`

export const SELECTABLE_SEARCH_RESULT_STATES: ReadonlySet<SearchResultState> = new Set([
  SearchResultState.None,
  SearchResultState.YourIdentity,
])

export const DIMMED_SEARCH_RESULT_STATES: ReadonlySet<SearchResultState> = new Set([
  SearchResultState.Self,
  SearchResultState.Sent,
])

export const SEARCH_RESULT_BADGES: Record<SearchResultState, SearchResultBadge | null> = {
  [SearchResultState.Self]: { variant: 'muted', text: 'This identity' },
  [SearchResultState.YourIdentity]: { variant: 'accent', text: 'Your identity' },
  [SearchResultState.Contact]: { variant: 'default', text: 'Contact' },
  [SearchResultState.Sent]: { variant: 'muted', text: 'Request sent' },
  [SearchResultState.Incoming]: { variant: 'accent', text: 'Wants to add you' },
  [SearchResultState.None]: null,
}

export const ADD_CONTACT_ROW_CLASS = `relative grid grid-cols-[1rem_2rem_minmax(0,1fr)_auto] items-center gap-3 min-h-13 border border-transparent ${SURFACE_ROW} transition-colors`

export const ADD_CONTACT_ROW_SELECTABLE_CLASS = 'hover:border-dash-brand/50 dark:hover:border-dash-mint/50'

export const ADD_CONTACT_ROW_CHECKED_CLASS = 'border-dash-brand! dark:border-dash-mint! bg-dash-brand/6! dark:bg-dash-mint/6!'

export const ADD_CONTACT_ROW_DIMMED_CLASS = 'opacity-40'

export const ADD_CONTACT_RADIO_CLASS = 'size-4 shrink-0 rounded-full border-2 border-dash-primary-dark-blue/30 dark:border-white/30'

export const ADD_CONTACT_RADIO_CHECKED_CLASS = 'border-[5px]! border-dash-brand! dark:border-dash-mint!'

export const ADD_CONTACT_RADIO_PLACEHOLDER_CLASS = 'block h-0.5 w-2.5 rounded-full bg-dash-primary-dark-blue/30 dark:bg-white/30'

export const ADD_CONTACT_LIST_CLASS = 'overflow-y-auto scrollbar-hide flex flex-col gap-[.625rem]'

export const ADD_CONTACT_LIST_HEIGHT_CLASS = 'max-h-[calc(100dvh-42rem)] min-h-48'

export const ADD_CONTACT_LIST_HEIGHT_WITH_ALERT_CLASS = 'max-h-[calc(100dvh-47.5rem)] min-h-28'

export const ADD_CONTACT_CHIP_CLASS = `${CHIP_ACTION} shrink-0 disabled:cursor-default disabled:opacity-50`

export const ADD_CONTACT_SKELETON_ROW_CLASS = 'h-13 rounded-[.875rem]'

export const ADD_CONTACT_SKELETON_ROWS = 4

export const ADD_CONTACT_IDENTITY_SKELETON_CLASS = 'h-[3.25rem] rounded-2xl'

export const ADD_CONTACT_IDENTITY_SKELETON_ROWS = 3

export const ADD_CONTACT_PANEL_NOTE_CLASS = 'block px-1'

export const ADD_CONTACT_FACT_ROW_CLASS = 'flex min-h-7 items-center justify-between gap-4'

export const ADD_CONTACT_FACT_VALUE_CLASS = 'flex min-w-0 items-center gap-2'
