import { DestinationKind } from '../enums/DestinationKind'

export const ADDRESS_BOOK_TYPES = [
  { value: DestinationKind.CoreAddress, kind: 'core', label: 'Core' },
  { value: DestinationKind.PlatformAddress, kind: 'platform', label: 'Platform' },
  { value: DestinationKind.Shielded, kind: 'shielded', label: 'Shielded' },
  { value: DestinationKind.Identity, kind: 'identity', label: 'Identities' },
]

export const ADDRESS_USAGE_OPTIONS = [
  { value: 'all', label: 'All addresses' },
  { value: 'used', label: 'Used addresses' },
  { value: 'balance', label: 'With balance' },
]

export const SHIELDED_CONTACT_BYTES = 44
export const SHIELDED_CONTACT_TYPE = 16
export const IDENTITY_CONTACT_BYTES = 32
