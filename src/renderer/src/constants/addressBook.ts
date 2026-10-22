import type { Contact } from '../api/types'
import { AddressBookSegment, AddressBookSort, AddressUsage } from '../enums/AddressBook'
import { DestinationKind } from '../enums/DestinationKind'
import type { AddressBookKind } from '../types/AddressBook'
import type { SegmentOption } from '../types/SegmentedControl'
import { CHIP_ACTION, SURFACE_ROW } from './surfaces'

export const ADDRESS_BOOK_ROUTES = {
  root: '/address-book',
  wallet: '/address-book/wallet',
} as const

export const ADDRESS_BOOK_PARAMS = {
  segment: 'type',
  tab: 'tab',
  usage: 'usage',
} as const

export const ADDRESS_BOOK_CACHE_NS = 'addressBook'

export const ADDRESS_BOOK_EMPTY: Contact[] = []

export const ADDRESS_BOOK_PAGE_SIZE = 50

export const ADDRESS_BOOK_KINDS: AddressBookKind[] = [
  DestinationKind.CoreAddress,
  DestinationKind.PlatformAddress,
  DestinationKind.Shielded,
  DestinationKind.Identity,
]

export const ADDRESS_BOOK_CASE_INSENSITIVE_KINDS: ReadonlySet<AddressBookKind> = new Set([
  DestinationKind.PlatformAddress,
  DestinationKind.Shielded,
])

export const ADDRESS_BOOK_KIND_LABELS: Record<AddressBookKind, string> = {
  [DestinationKind.CoreAddress]: 'Core address',
  [DestinationKind.PlatformAddress]: 'Platform address',
  [DestinationKind.Identity]: 'Identity',
  [DestinationKind.Shielded]: 'Shielded address',
}

export const ADDRESS_BOOK_KIND_SEGMENTS: Record<AddressBookKind, AddressBookSegment> = {
  [DestinationKind.CoreAddress]: AddressBookSegment.Core,
  [DestinationKind.PlatformAddress]: AddressBookSegment.Platform,
  [DestinationKind.Identity]: AddressBookSegment.Identities,
  [DestinationKind.Shielded]: AddressBookSegment.Shielded,
}

export const ADDRESS_BOOK_SEGMENT_ORDER: AddressBookSegment[] = [
  AddressBookSegment.All,
  AddressBookSegment.Core,
  AddressBookSegment.Platform,
  AddressBookSegment.Identities,
  AddressBookSegment.Shielded,
]

export const ADDRESS_BOOK_SEGMENT_LABELS: Record<AddressBookSegment, string> = {
  [AddressBookSegment.All]: 'All',
  [AddressBookSegment.Core]: 'Core',
  [AddressBookSegment.Platform]: 'Platform',
  [AddressBookSegment.Identities]: 'Identities',
  [AddressBookSegment.Shielded]: 'Shielded',
}

export const ADDRESS_BOOK_SEGMENT_EMPTY: Record<AddressBookSegment, string> = {
  [AddressBookSegment.All]: 'No saved addresses',
  [AddressBookSegment.Core]: 'No saved Core addresses',
  [AddressBookSegment.Platform]: 'No saved Platform addresses',
  [AddressBookSegment.Identities]: 'No saved identities',
  [AddressBookSegment.Shielded]: 'No saved shielded addresses',
}

export const ADDRESS_BOOK_SORT_OPTIONS: SegmentOption<AddressBookSort>[] = [
  { value: AddressBookSort.Name, label: 'Name A–Z' },
  { value: AddressBookSort.Recent, label: 'Recently added' },
]

export const ADDRESS_BOOK_COUNT_SEPARATOR = ' · '

export const ADDRESS_BOOK_COPY = {
  walletAddresses: 'Wallet addresses',
  add: 'Add address',
  searchPlaceholder: 'Search name or address',
  searchLabel: 'Search the address book',
  sortLabel: 'Sort entries',
  segmentLabel: 'Entry type',
  emptyDescription: 'Save the addresses and identities you send to, then pick them in Send.',
  loadFailed: "Couldn't load the address book",
  noNetwork: 'No active network',
  noMatchLead: 'No entries match',
  clearSearch: 'Clear search',
  showAll: 'Show in All',
  send: 'Send',
  open: 'Details for',
  thisWallet: 'This wallet',
  unrecognized: 'Unrecognized',
  unrecognizedHint: 'Not a valid address or identity ID on this network.',
  menuTitle: 'Entry actions',
  copyAddress: 'Copy address',
  edit: 'Edit',
  remove: 'Remove',
}

export const ENTRY_DETAIL_COPY = {
  type: 'Type',
  network: 'Network',
  added: 'Added',
  close: 'Close',
  send: 'Send',
  edit: 'Edit',
  remove: 'Remove',
  showQr: 'Show QR code',
  explorer: 'Open in explorer',
}

export const ENTRY_EDIT_COPY = {
  addTitle: 'Add address',
  editTitle: 'Edit address',
  nameLabel: 'Name',
  namePlaceholder: 'e.g. Alex or Exchange',
  addressLabel: 'Address or identity ID',
  addressPlaceholder: 'Paste an address or identity ID',
  invalidLead: 'Not a valid',
  invalidTail: 'address or identity ID.',
  duplicateLead: 'Already saved as',
  cancel: 'Cancel',
  save: 'Save',
  added: 'Address saved',
  updated: 'Address updated',
  failed: "Couldn't save the address",
}

export const REMOVE_ENTRY_COPY = {
  titlePrefix: 'Remove',
  description: 'Only the saved entry is deleted.',
  cancel: 'Cancel',
  remove: 'Remove',
  removed: 'Removed',
  failed: "Couldn't remove the entry",
}

export const WALLET_ADDRESSES_COPY = {
  searchPlaceholder: 'Search address or saved name',
  searchLabel: 'Search wallet addresses',
  usageLabel: 'Address usage',
  save: 'Save to address book',
  saved: 'Saved in the address book',
  noMatch: 'No addresses match the filters',
  clearFilters: 'Clear filters',
}

export const ADDRESS_USAGE_OPTIONS: SegmentOption<AddressUsage>[] = [
  { value: AddressUsage.All, label: 'All' },
  { value: AddressUsage.Used, label: 'Used' },
  { value: AddressUsage.Balance, label: 'With balance' },
]

export const ADDRESS_BOOK_LIST_CLASS = 'flex flex-col gap-[.625rem]'

export const ADDRESS_BOOK_ROW_CLASS = `relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 min-h-13 ${SURFACE_ROW} transition-colors hover:dash-block-accent-5`

export const ADDRESS_BOOK_ROW_CONTENT_CLASS = 'pointer-events-none flex min-w-0 flex-col gap-0.5'

export const ADDRESS_BOOK_ROW_TRAILING_CLASS = 'pointer-events-none relative z-10 flex items-center gap-2'

export const ADDRESS_BOOK_ROW_ACTION_CLASS = `${CHIP_ACTION} pointer-events-auto font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40`

export const ADDRESS_BOOK_ROW_SKELETON_CLASS = 'h-13 rounded-[.875rem]'

export const ADDRESS_BOOK_SKELETON_ROWS = 6

export const ADDRESS_BOOK_SEARCH_SKELETON_ROWS = 4

export const ENTRY_INPUT_CLASS = 'h-14.25 rounded-[1.25rem] bg-transparent!'

export const RECIPIENT_BOOK_COPY = {
  saveCurrent: 'Save current',
  name: 'Name',
  save: 'Save',
  cancel: 'Cancel',
  remove: 'Remove from address book',
  empty: 'No saved addresses yet',
  loading: 'Loading address book',
  retry: 'Retry',
  saveFailed: "Couldn't save the address",
  removeFailed: "Couldn't remove the entry",
  ownAddresses: 'Your addresses',
  ownIdentities: 'Your identities',
}
