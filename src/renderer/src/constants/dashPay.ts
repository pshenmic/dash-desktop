import type { IdentityKeyBoundsDto, IdentityKeyRequestDto } from '@renderer/api/types'
import {
  ContactSegment,
  ContactSort,
  DashPayContactRelationship,
  DashPayReadiness,
  DashPayTab,
  IdentityKeyPurpose,
  IdentityKeySecurityLevel,
  SearchResultState,
} from '@renderer/enums/DashPay'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { SourceKind } from '@renderer/enums/SourceKind'
import type { CustomBadgeProps } from '@renderer/types/CustomBadge'
import type { AliasSearchPage } from '@renderer/types/Dpns'
import type { SegmentOption } from '@renderer/types/SegmentedControl'
import { SURFACE_ROW } from './surfaces'

export const DASHPAY_CONTRACT_ID = 'Bwr4WHCPz5rFVAD87RqTs3izo4zpzwsEdKPWUT1NS1C7'

export const DASHPAY_CONTACT_REQUEST_DOCUMENT = 'contactRequest'

export const DASHPAY_KEY_BOUNDS: IdentityKeyBoundsDto = {
  contractId: DASHPAY_CONTRACT_ID,
  documentType: DASHPAY_CONTACT_REQUEST_DOCUMENT,
}

export const DASHPAY_SIGNING_KEY: IdentityKeyRequestDto = {
  purpose: IdentityKeyPurpose.Authentication,
  securityLevel: IdentityKeySecurityLevel.High,
  contractBounds: null,
}

export const DASHPAY_REQUIRED_KEYS: IdentityKeyRequestDto[] = [
  { purpose: IdentityKeyPurpose.Encryption, securityLevel: IdentityKeySecurityLevel.Medium, contractBounds: DASHPAY_KEY_BOUNDS },
  { purpose: IdentityKeyPurpose.Decryption, securityLevel: IdentityKeySecurityLevel.Medium, contractBounds: DASHPAY_KEY_BOUNDS },
  DASHPAY_SIGNING_KEY,
]

export const IDENTITY_KEY_SLOT_LIMIT = 20

export const DASHPAY_PARAMS = {
  identity: 'identity',
  tab: 'tab',
  segment: 'segment',
  contact: 'contact',
  label: 'label',
  query: 'q',
  preset: 'preset',
} as const

export const DASHPAY_KEYS_PRESET = 'dashpay'

export const DASHPAY_CONTACTS_PAGE_SIZE = 50

export const DASHPAY_PAYMENTS_PAGE_SIZE = 50

export const DASHPAY_USERNAMES_PAGE_SIZE = 50

export const OVERVIEW_PREVIEW_LIMIT = 3

export const DASHPAY_ALIASES_REFRESH_MS = 60_000

export const DASHPAY_CONTACTS_REFRESH_MS = 60_000

export const ALIAS_SEARCH_DEBOUNCE_MS = 300

export const ALIAS_SEARCH_MIN_CHARS = 1

export const ALIAS_SEARCH_RESULT_CAP = 100

export const DASHPAY_IDENTITY_STORAGE_PREFIX = 'dashpay.identity.'

export const DASHPAY_TAB_LABELS: Record<DashPayTab, string> = {
  [DashPayTab.Overview]: 'Overview',
  [DashPayTab.Contacts]: 'Contacts',
  [DashPayTab.Usernames]: 'Usernames',
  [DashPayTab.Keys]: 'Keys',
}

export const CONTACT_SEGMENT_LABELS: Record<ContactSegment, string> = {
  [ContactSegment.All]: 'All',
  [ContactSegment.Contacts]: 'Contacts',
  [ContactSegment.Requests]: 'Requests',
  [ContactSegment.Sent]: 'Sent',
}

export const RELATIONSHIP_SEGMENTS: Record<DashPayContactRelationship, ContactSegment> = {
  [DashPayContactRelationship.Incoming]: ContactSegment.Requests,
  [DashPayContactRelationship.Established]: ContactSegment.Contacts,
  [DashPayContactRelationship.Outgoing]: ContactSegment.Sent,
}

export const CONTACT_GROUP_ORDER: ContactSegment[] = [ContactSegment.Requests, ContactSegment.Contacts, ContactSegment.Sent]

export const CONTACT_GROUP_LABELS = {
  digits: '#',
  noUsername: 'No username',
} as const

export const CONTACT_LETTER_GROUP_TAIL: string[] = [CONTACT_GROUP_LABELS.digits, CONTACT_GROUP_LABELS.noUsername]

export const CONTACT_DIGIT_PATTERN = /^[0-9]$/

export const SEARCH_STATE_BY_RELATIONSHIP: Record<DashPayContactRelationship, SearchResultState> = {
  [DashPayContactRelationship.Established]: SearchResultState.Contact,
  [DashPayContactRelationship.Outgoing]: SearchResultState.Sent,
  [DashPayContactRelationship.Incoming]: SearchResultState.Incoming,
}

export const CONTACT_SORT_OPTIONS: SegmentOption<ContactSort>[] = [
  { value: ContactSort.Recent, label: 'Recent activity' },
  { value: ContactSort.Name, label: 'Name A–Z' },
  { value: ContactSort.Oldest, label: 'Oldest first' },
]

export const DASHPAY_READINESS_BADGES: Record<DashPayReadiness, Pick<CustomBadgeProps, 'variant' | 'text'>> = {
  [DashPayReadiness.Ready]: { variant: 'default', text: 'Ready' },
  [DashPayReadiness.NeedsKeys]: { variant: 'warning', text: 'Needs keys' },
  [DashPayReadiness.NoKeySlots]: { variant: 'error', text: 'No key slots' },
  [DashPayReadiness.NoUsername]: { variant: 'muted', text: 'No username' },
}

export const READINESS_TONE_CLASS: Record<DashPayReadiness, string> = {
  [DashPayReadiness.Ready]: 'dash-text-primary',
  [DashPayReadiness.NeedsKeys]: 'text-dash-orange',
  [DashPayReadiness.NoKeySlots]: 'text-dash-red',
  [DashPayReadiness.NoUsername]: '',
}

export const RELATIONSHIP_BADGES: Record<DashPayContactRelationship, Pick<CustomBadgeProps, 'variant' | 'text'>> = {
  [DashPayContactRelationship.Established]: { variant: 'default', text: 'Contact' },
  [DashPayContactRelationship.Incoming]: { variant: 'accent', text: 'Request received' },
  [DashPayContactRelationship.Outgoing]: { variant: 'muted', text: 'Request sent' },
}

export const DASHPAY_CONTACT_ROW_CLASS = `relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 min-h-13 ${SURFACE_ROW} transition-colors hover:dash-block-accent-5`

export const DASHPAY_SETUP_COPY = {
  noIdentity: 'No identity yet',
  afterIdentity: 'After step 1',
  usernameTodo: 'So people can find you',
  keysDone: 'Encryption keys added',
  keysTodo: 'Needed for contacts',
} as const

export const DASHPAY_PAYMENT_COPY = {
  sent: 'Sent',
  received: 'Received',
  transactionId: 'Transaction ID',
} as const

export const DASHPAY_ROUTES = {
  root: '/dashpay',
  registerUsername: '/dashpay/usernames/new',
  addContact: '/dashpay/contacts/new',
  addKeys: '/dashpay/keys/new',
} as const

export const DASHPAY_TOP_UP_HREF = `/send?from=${SourceKind.Core}&to=${DestinationKind.Identity}`

export const FEE_SHORTFALL_COPY = {
  feeError: 'Couldn’t get the fee',
  retry: 'Retry',
  needs: 'needs',
  more: 'Dash more.',
  topUp: 'Top up',
} as const

export const DASHPAY_CACHE_NAMESPACES = {
  aliases: 'dashpay-aliases',
  aliasSearch: 'dashpay-alias-search',
  contacts: 'dashpay-contacts',
  payments: 'dashpay-payments',
} as const

export const DASHPAY_LOAD_ERRORS = {
  aliases: 'Failed to load usernames',
  aliasSearch: 'Couldn’t search usernames',
  contacts: 'Failed to load contacts',
  payments: 'Failed to load payments',
} as const

export const EMPTY_ALIAS_SEARCH: AliasSearchPage = { query: '', results: [] }
