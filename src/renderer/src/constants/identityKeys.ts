import { IdentityKeyPurpose, IdentityKeySecurityLevel, IdentityKeyVariant } from '@renderer/enums/IdentityKeys'
import type { IdentityKeyVariantDefinition, KeyVariantGroup } from '@renderer/types/IdentityKeys'

export const IDENTITY_KEY_TYPE_ECDSA = 'ECDSA_SECP256K1'

export const IDENTITY_KEY_LABEL_SEPARATOR = ' · '

export const DASHPAY_BOUNDS_LABEL = 'DashPay'

const DASHPAY_BOUND_CAPTION = 'Bound to DashPay contact requests'

const UNBOUND_CAPTION = 'Not bound'

export const IDENTITY_KEY_VARIANTS: Record<IdentityKeyVariant, IdentityKeyVariantDefinition> = {
  [IdentityKeyVariant.EncDashPay]: { variant: IdentityKeyVariant.EncDashPay, purpose: IdentityKeyPurpose.Encryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: true, caption: DASHPAY_BOUND_CAPTION },
  [IdentityKeyVariant.DecDashPay]: { variant: IdentityKeyVariant.DecDashPay, purpose: IdentityKeyPurpose.Decryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: true, caption: DASHPAY_BOUND_CAPTION },
  [IdentityKeyVariant.AuthCritical]: { variant: IdentityKeyVariant.AuthCritical, purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.Critical, dashPayBound: false, caption: null },
  [IdentityKeyVariant.AuthHigh]: { variant: IdentityKeyVariant.AuthHigh, purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.High, dashPayBound: false, caption: null },
  [IdentityKeyVariant.AuthMedium]: { variant: IdentityKeyVariant.AuthMedium, purpose: IdentityKeyPurpose.Authentication, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: false, caption: null },
  [IdentityKeyVariant.Enc]: { variant: IdentityKeyVariant.Enc, purpose: IdentityKeyPurpose.Encryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: false, caption: UNBOUND_CAPTION },
  [IdentityKeyVariant.Dec]: { variant: IdentityKeyVariant.Dec, purpose: IdentityKeyPurpose.Decryption, securityLevel: IdentityKeySecurityLevel.Medium, dashPayBound: false, caption: UNBOUND_CAPTION },
  [IdentityKeyVariant.Transfer]: { variant: IdentityKeyVariant.Transfer, purpose: IdentityKeyPurpose.Transfer, securityLevel: IdentityKeySecurityLevel.Critical, dashPayBound: false, caption: 'Credit transfers and withdrawals' },
}

export const IDENTITY_KEY_PURPOSE_LABELS: Record<string, string> = {
  AUTHENTICATION: 'Authentication',
  ENCRYPTION: 'Encryption',
  DECRYPTION: 'Decryption',
  TRANSFER: 'Transfer',
}

export const IDENTITY_KEY_LEVEL_LABELS: Record<string, string> = {
  MASTER: 'Master',
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
}

export const IDENTITY_KEY_TYPE_LABELS: Record<string, string> = {
  ECDSA_SECP256K1: 'ECDSA secp256k1',
  BLS12_381: 'BLS12-381',
  ECDSA_HASH160: 'ECDSA hash160',
  BIP13_SCRIPT_HASH: 'BIP13 script hash',
  EDDSA_25519_HASH160: 'EdDSA 25519 hash160',
}

export const IDENTITY_KEY_TABLE_GRID = 'grid-cols-[2.5rem_minmax(0,1.1fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1.5fr)_5rem]'

export const IDENTITY_KEYS_PER_TRANSITION = 6

export const KEY_COUNT_COPY = {
  of: 'of',
  selected: 'selected',
  upTo: 'Up to',
  perTransition: 'keys per transaction',
  limitReached: '· limit per transaction',
  onIdentity: 'on identity',
  key: 'key',
  keys: 'keys',
  keyAdded: 'key added',
  keysAdded: 'keys added',
  idPrefix: '#',
} as const

export const IDENTITY_KEYS_COPY = {
  title: 'Keys',
  addKeys: 'Add keys',
  active: 'Active',
  disabled: 'Disabled',
  unbound: '—',
  empty: 'No keys on this identity',
} as const

export const KEYS_TABLE_HEADERS = ['#', 'Purpose', 'Level', 'Type', 'Bound to', 'Status']

export const KEYS_TABLE_INNER_CLASS = 'min-w-[40rem]'

export const KEY_TABLE_ROW_CLASS = 'grid min-h-12 items-center gap-3 border-t border-dash-primary-dark-blue/10 dark:border-white/10 px-2.5 py-2.5'

export const KEY_VARIANT_ROW_CLASS = 'grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-center gap-3'

export const KEYS_FACT_ROW_CLASS = 'flex items-center justify-between gap-4'

export const KEYS_FACT_DIVIDER_CLASS = 'h-px bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const KEYS_SIGNED_COPY = {
  identityBalance: 'Identity balance',
  balanceAfter: 'Balance after',
  hashLabel: 'State transition hash',
  pending: 'Adding keys…',
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
  backToIdentities: 'Back to identities',
} as const

export const KEY_VARIANT_GROUPS: KeyVariantGroup[] = [
  { dashPayBound: true, label: 'DashPay', definitions: Object.values(IDENTITY_KEY_VARIANTS).filter(definition => definition.dashPayBound) },
  { dashPayBound: false, label: 'Other keys', definitions: Object.values(IDENTITY_KEY_VARIANTS).filter(definition => !definition.dashPayBound) },
]

export const KEY_VARIANT_ORDER = Object.keys(IDENTITY_KEY_VARIANTS) as IdentityKeyVariant[]
