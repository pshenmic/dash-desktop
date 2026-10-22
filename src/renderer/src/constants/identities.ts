import { SURFACE_ROW } from './surfaces'

export const IDENTITIES_ROUTES = {
  root: '/identities',
  register: '/identities/register',
  identity: '/identities/:identifier',
  addKeys: '/identities/:identifier/keys/new',
} as const

export const IDENTITY_ROUTE_PARAM = ':identifier'

export const IDENTITY_ROW_CLASS = `relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 min-h-13 ${SURFACE_ROW} transition-colors hover:dash-block-accent-5`

export const IDENTITY_ROW_CONTENT_CLASS = 'pointer-events-none flex min-w-0 flex-col gap-1'

export const IDENTITY_ROW_TRAILING_CLASS = 'pointer-events-none relative z-10 flex items-center gap-3'

export const IDENTITY_ROW_ACTIONS_CLASS = 'pointer-events-auto relative z-10 flex shrink-0 items-center gap-[.3125rem]'

export const IDENTITY_ROW_COPY = {
  open: 'Open',
  menuTitle: 'Identity actions',
  manageKeys: 'Manage keys',
  copyId: 'Copy identity ID',
  explorer: 'Open in explorer',
} as const

export const IDENTITY_DETAIL_COPY = {
  title: 'Identity',
  balance: 'Balance',
  usernames: 'Usernames',
  keys: 'Keys',
  active: 'active',
  explorer: 'Open in explorer',
  missing: 'This identity is no longer in this wallet',
  backToIdentities: 'Back to identities',
  loadFailed: 'Failed to load identities',
} as const

export const IDENTITY_DETAIL_SKELETON_ROWS = 4

export const IDENTITY_DETAIL_SKELETON_CLASS = 'h-12 rounded-[.875rem]'

export const IDENTITY_DETAIL_ROOT_CLASS = 'flex flex-col px-12 pb-12'

export const IDENTITY_TOKEN_ICON_CLASS = 'dash-text-primary'
