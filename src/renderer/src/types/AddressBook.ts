import type { ReactNode } from 'react'
import type { Contact, Network } from '../api/types'
import type { DestinationKind } from '../enums/DestinationKind'
import type { AddressBookAddressCheck, AddressBookSegment, AddressBookSort, AddressUsage } from '../enums/AddressBook'
import type { RetryButtonProps } from './RetryButton'

export type AddressBookKind = Exclude<DestinationKind, DestinationKind.NewIdentity>

export interface AddressBookEntry {
  contact: Contact
  kind: AddressBookKind | null
  owned: boolean
}

export type AddressBookSegmentCounts = Record<AddressBookSegment, number>

export interface AddressBookAddressStatus {
  check: AddressBookAddressCheck
  kind: AddressBookKind | null
  duplicate: Contact | null
}

export interface UseAddressBook {
  contacts: Contact[]
  loading: boolean
  err: string | null
  network: Network | undefined
  retry: () => void
  addContact: (label: string, address: string) => Promise<void>
  updateContact: (contact: Contact, label: string, address: string) => Promise<void>
  deleteContact: (id: number) => Promise<void>
}

export interface AddressBookEditorState {
  contact: Contact | null
  address: string
}

export interface AddressBookKindIconProps {
  kind: AddressBookKind | null
  address: string
}

export interface AddressBookToolbarProps {
  query: string
  onQueryChange: (query: string) => void
  sort: AddressBookSort
  onSortChange: (sort: AddressBookSort) => void
  segment: AddressBookSegment
  onSegmentChange: (segment: AddressBookSegment) => void
  counts: AddressBookSegmentCounts
}

export interface AddressBookRowProps {
  entry: AddressBookEntry
  onOpen: (entry: AddressBookEntry) => void
  onSend: (entry: AddressBookEntry) => void
  onEdit: (contact: Contact) => void
  onRemove: (contact: Contact) => void
}

export interface EntryDetailModalProps {
  entry: AddressBookEntry | null
  network: Network | undefined
  onClose: () => void
  onSend: (entry: AddressBookEntry) => void
  onEdit: (contact: Contact) => void
  onRemove: (contact: Contact) => void
}

export interface EntryDetailLine {
  label: string
  value: string
}

export interface EntryEditModalProps {
  state: AddressBookEditorState | null
  owned?: ReadonlySet<string>
  onClose: () => void
}

export interface RemoveEntryModalProps {
  contact: Contact | null
  onClose: () => void
}

export interface WalletAddressToolbarProps {
  query: string
  onQueryChange: (query: string) => void
  usage: AddressUsage
  onUsageChange: (usage: AddressUsage) => void
}

export interface WalletAddressListProps {
  coreGated?: boolean
}

export interface SaveableAddressProps {
  savedName?: string
  onSave?: () => void
}

export interface ShieldedAddressTabProps {
  walletId: string | undefined
  toolbar: ReactNode
  query: string
  usage: AddressUsage
  savedNames: ReadonlyMap<string, string>
  onSave: (address: string) => void
  onClearFilters: () => void
}

export interface WalletAddressTabContentProps<T> {
  items: T[]
  total: number
  loading: boolean
  err: string | null
  errorMessage: string
  emptyMessage: string
  renderItem: (item: T) => React.JSX.Element
  onRetry?: RetryButtonProps['onRetry']
  onClearFilters: () => void
}
