import type { IdentityKeyVariant } from '@renderer/enums/DashPay'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { SourceKind } from '@renderer/enums/SourceKind'
import type { KeyVariantGroup } from '@renderer/types/DashPayKeys'
import { IDENTITY_KEY_VARIANTS } from './identityKeys'

export const READINESS_ALERT_COPY = {
  needsKeysTitle: 'DashPay keys missing',
  needsKeysDescription: 'Enable DashPay to send and accept requests.',
  enable: 'Enable',
  noSlotsTitle: 'No key slots left',
  noSlotsDescription: 'This identity can’t add the keys DashPay needs.',
  switchIdentity: 'Switch identity',
  noUsernameTitle: 'No username yet',
  noUsernameDescription: 'People can add you only by identity ID.',
  register: 'Register',
} as const

export const KEY_COUNT_COPY = {
  of: 'of',
  slotsUsed: 'key slots used',
  separator: '·',
  leftAfter: 'left after this',
  only: 'Only',
  noSlotsLeft: 'No key slots left.',
  slotLeft: 'key slot left.',
  slotsLeft: 'key slots left.',
  onIdentity: 'on identity',
  keyAdded: 'key added',
  keysAdded: 'keys added',
  idPrefix: '#',
} as const

export const KEYS_TAB_COPY = {
  addKeys: 'Add keys',
  noSlots: 'No key slots left',
  active: 'Active',
  disabled: 'Disabled',
  unbound: '—',
} as const

export const KEYS_TABLE_HEADERS = ['#', 'Purpose', 'Level', 'Type', 'Bound to', 'Status']

export const KEYS_TABLE_INNER_CLASS = 'min-w-[40rem]'

export const KEY_TABLE_ROW_CLASS = 'grid min-h-12 items-center gap-3 border-t border-dash-primary-dark-blue/10 dark:border-white/10 px-2.5 py-2.5'

export const SLOT_METER_TRACK_WRAPPER_CLASS = 'w-40 shrink-0'

export const KEY_VARIANT_ROW_CLASS = 'grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-center gap-3'

export const KEYS_FACT_ROW_CLASS = 'flex items-center justify-between gap-4'

export const KEYS_FACT_DIVIDER_CLASS = 'h-px bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const KEY_SHORTFALL_COPY = {
  feeError: 'Couldn’t get the fee',
  retry: 'Retry',
  needs: 'needs',
  more: 'Dash more.',
  topUp: 'Top up',
} as const

export const KEYS_TOP_UP_HREF = `/send?${new URLSearchParams({ from: SourceKind.Core, to: DestinationKind.Identity })}`

export const KEYS_SIGNED_COPY = {
  identityBalance: 'Identity balance',
  balanceAfter: 'Balance after',
  hashLabel: 'State transition hash',
  pending: 'Adding keys…',
} as const

export const ENABLE_DASHPAY_COPY = {
  title: 'Enable DashPay',
  descriptionLead: 'Adds the keys',
  descriptionTail: 'needs for contacts.',
  confirm: 'Enable',
  toLabel: 'Adds',
  doneLead: 'DashPay enabled for',
  addContact: 'Add contact',
} as const

export const ADD_KEYS_COPY = {
  identityLabel: 'For identity',
  keysStep: 'Keys',
  confirmStep: 'Confirm',
  submit: 'Create keys',
  recommended: 'Recommended',
  fee: 'Fee',
  identity: 'Identity',
  keys: 'Keys',
  modalTitle: 'Create identity keys',
  missingIdentity: 'This identity is no longer in this wallet',
  backToDashPay: 'Back to DashPay',
  loadError: 'Failed to load identities',
} as const

export const KEY_VARIANT_GROUPS: KeyVariantGroup[] = [
  { dashPayBound: true, label: 'DashPay', definitions: Object.values(IDENTITY_KEY_VARIANTS).filter(definition => definition.dashPayBound) },
  { dashPayBound: false, label: 'Other keys', definitions: Object.values(IDENTITY_KEY_VARIANTS).filter(definition => !definition.dashPayBound) },
]

export const KEY_VARIANT_ORDER = Object.keys(IDENTITY_KEY_VARIANTS) as IdentityKeyVariant[]
