import { ContactSegment } from '@renderer/enums/DashPay'
import { CHIP_ACTION } from './surfaces'

export const CONTACT_SEGMENT_ORDER: ContactSegment[] = [
  ContactSegment.All,
  ContactSegment.Contacts,
  ContactSegment.Requests,
  ContactSegment.Sent,
]

export const CONTACT_SEGMENT_EMPTY: Record<ContactSegment, string> = {
  [ContactSegment.All]: 'No contacts yet',
  [ContactSegment.Contacts]: 'No contacts',
  [ContactSegment.Requests]: 'No requests',
  [ContactSegment.Sent]: 'No sent requests',
}

export const CONTACT_COPY_SEPARATOR = ' · '

export const CONTACTS_TAB_COPY = {
  searchPlaceholder: 'Search name or identity ID',
  searchLabel: 'Search contacts',
  sortLabel: 'Sort contacts',
  segmentLabel: 'Contact filter',
  add: 'Add contact',
  enableFirst: 'Enable DashPay first',
  emptyTitle: 'No contacts yet',
  emptyDescription: 'Find people by their .dash username.',
  noMatchLead: 'No contacts match',
  noMatchFor: 'for',
  clearSearch: 'Clear search',
  showLead: 'Show',
  inAll: 'in All',
} as const

export const CONTACT_ROW_COPY = {
  open: 'Open',
  noUsername: 'No username',
  wantsToAdd: 'Wants to add you',
  since: 'Since',
  requestSent: 'Request sent',
  accept: 'Accept',
  pay: 'Pay',
  cantPay: 'Can’t pay',
  cantPayHint: 'Ask them to send a new contact request.',
  awaiting: 'Awaiting',
  yourIdentity: 'Your identity',
  extraPrefix: '+',
} as const

export const CONTACT_MENU_COPY = {
  title: 'Contact',
  open: 'Open',
  pay: 'Pay',
  accept: 'Accept',
  copyId: 'Copy identity ID',
  copyName: 'Copy username',
} as const

export const CONTACT_DETAIL_COPY = {
  contactOf: 'Contact of',
  since: 'since',
  wantsToAdd: 'Wants to add',
  requestSentFrom: 'Request sent from',
  actAs: 'Act as',
  actAsThis: 'Act as this identity',
  accept: 'Accept',
  pay: 'Pay',
  theyAdded: 'They added you',
  youAdded: 'You added them',
  sent: 'Sent',
  received: 'Received',
  also: 'also',
  more: 'more',
  brokenTitle: 'Payments unavailable',
  brokenLead: 'Ask',
  brokenTail: 'to send you a new contact request.',
  unavailable: 'This contact isn’t available',
  backToContacts: 'Back to contacts',
  openInExplorer: 'Open in explorer',
  missingValue: '—',
} as const

export const CONTACT_PAYMENTS_COPY = {
  title: 'Payments',
  empty: 'No payments yet',
  menuTitle: 'Payment',
  copyTxid: 'Copy transaction ID',
  openInExplorer: 'Open in explorer',
} as const

export const ACCEPT_REQUEST_COPY = {
  title: 'Accept contact request',
  confirm: 'Accept',
  pending: 'Accepting…',
  fee: 'Fee',
  identityBalance: 'Identity balance',
  balanceAfter: 'Balance after',
  nowContact: 'is now a contact',
  as: 'As',
  pay: 'Pay',
} as const

export const PAY_CONTACT_COPY = {
  title: 'Pay contact',
  review: 'Review',
  confirm: 'Sign & send',
  pending: 'Sending…',
  contactSince: 'Contact since',
  available: 'Available',
  networkFee: 'Network fee',
  total: 'Total',
  coreSource: 'Dash Core (L1)',
  payingAs: 'Paying as',
  sent: 'Dash sent',
  to: 'To',
  from: 'from',
  contactsSuffix: '’s contacts',
  transactionId: 'Transaction ID',
} as const

export const DASH_AMOUNT_INPUT_PATTERN = /^(?:\d+(?:\.\d{0,8})?|\.\d{0,8})$/

export const CONTACT_OTHER_NAMES_LIMIT = 3

export const CONTACT_DETAIL_ROOT_CLASS = 'flex flex-col px-12 pb-12'

export const CONTACT_ROW_SKELETON_CLASS = 'h-13 rounded-[.875rem]'

export const CONTACT_LIST_SKELETON_ROWS = 6

export const CONTACT_SEARCH_SKELETON_ROWS = 4

export const CONTACT_PAYMENTS_SKELETON_ROWS = 3

export const CONTACT_PAYMENT_SKELETON_CLASS = 'h-[4.25rem] rounded-[.875rem]'

export const CONTACT_ROW_ACTION_CLASS = `${CHIP_ACTION} pointer-events-auto font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40`

export const CONTACT_TOKEN_ICON_CLASS = 'dash-text-primary'
