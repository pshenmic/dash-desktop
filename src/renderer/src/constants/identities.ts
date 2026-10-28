export const IDENTITIES_ROUTES = {
  root: '/identities',
  register: '/identities/register',
  identity: '/identities/:identifier',
  addKeys: '/identities/:identifier/keys/new',
} as const

export const IDENTITY_ROUTE_PARAM = ':identifier'

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

export const IDENTITY_DETAIL_ROOT_CLASS = 'flex flex-col px-12 pb-12'

export const IDENTITY_TOKEN_ICON_CLASS = 'dash-text-primary'
