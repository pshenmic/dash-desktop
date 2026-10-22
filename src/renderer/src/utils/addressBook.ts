import type { Contact, Network } from '../api/types'
import {
  ADDRESS_BOOK_CASE_INSENSITIVE_KINDS,
  ADDRESS_BOOK_KIND_SEGMENTS,
  ADDRESS_BOOK_KINDS,
  ADDRESS_BOOK_SEGMENT_ORDER,
} from '../constants/addressBook'
import { NAME_COLLATOR } from '../constants/listToolbar'
import { AddressBookAddressCheck, AddressBookSegment, AddressBookSort, AddressUsage } from '../enums/AddressBook'
import type {
  AddressBookAddressStatus,
  AddressBookEntry,
  AddressBookKind,
  AddressBookSegmentCounts,
} from '../types/AddressBook'
import type { OwnRecipientInventory } from '../types/SendRecipients'
import { isValidDestinationAddress } from './destinationAddress'

export function addressBookKind(address: string, network: Network | null): AddressBookKind | null {
  const value = address.trim()
  if (value === '') return null
  return ADDRESS_BOOK_KINDS.find(kind => isValidDestinationAddress(kind, value, network)) ?? null
}

export function addressBookKey(address: string): string {
  const value = address.trim()
  const kind = addressBookKind(value, null)
  return kind != null && ADDRESS_BOOK_CASE_INSENSITIVE_KINDS.has(kind) ? value.toLowerCase() : value
}

export function walletAddressSet(inventory: OwnRecipientInventory): Set<string> {
  const addresses = [
    ...inventory.receiving.map(address => address.address),
    ...inventory.change.map(address => address.address),
    ...inventory.platformAddresses.map(address => address.platformAddress),
    ...inventory.identities.map(identity => identity.identifier),
    ...inventory.shieldedAddresses,
    ...(inventory.shieldedNotes ?? []).map(note => note.address),
  ]
  return new Set(addresses.filter(Boolean).map(addressBookKey))
}

export function savedNamesByAddress(contacts: Contact[]): Map<string, string> {
  return new Map(contacts.map(contact => [addressBookKey(contact.address), contact.label]))
}

export function addressBookEntries(contacts: Contact[], network: Network | null, owned: ReadonlySet<string>): AddressBookEntry[] {
  return contacts.map(contact => ({
    contact,
    kind: addressBookKind(contact.address, network),
    owned: owned.has(addressBookKey(contact.address)),
  }))
}

export function entrySegment(entry: AddressBookEntry): AddressBookSegment | null {
  return entry.kind == null ? null : ADDRESS_BOOK_KIND_SEGMENTS[entry.kind]
}

export function matchesAddressBookQuery(contact: Contact, query: string): boolean {
  const needle = query.trim().toLowerCase()
  return needle === '' || contact.label.toLowerCase().includes(needle) || contact.address.toLowerCase().includes(needle)
}

export function countAddressBookSegments(entries: AddressBookEntry[], query: string): AddressBookSegmentCounts {
  const counts = Object.fromEntries(ADDRESS_BOOK_SEGMENT_ORDER.map(segment => [segment, 0])) as AddressBookSegmentCounts
  for (const entry of entries) {
    if (!matchesAddressBookQuery(entry.contact, query)) continue
    counts[AddressBookSegment.All]++
    const segment = entrySegment(entry)
    if (segment != null) counts[segment]++
  }
  return counts
}

export function filterAddressBook(entries: AddressBookEntry[], query: string, segment: AddressBookSegment): AddressBookEntry[] {
  return entries.filter(entry =>
    (segment === AddressBookSegment.All || entrySegment(entry) === segment) && matchesAddressBookQuery(entry.contact, query))
}

export function sortAddressBook(entries: AddressBookEntry[], sort: AddressBookSort): AddressBookEntry[] {
  return [...entries].sort((a, b) => sort === AddressBookSort.Recent
    ? b.contact.createdAt - a.contact.createdAt
    : NAME_COLLATOR.compare(a.contact.label, b.contact.label) || NAME_COLLATOR.compare(a.contact.address, b.contact.address))
}

export function addressBookAddressStatus(
  address: string,
  network: Network | null,
  contacts: Contact[],
  editingId: number | null,
): AddressBookAddressStatus {
  if (address.trim() === '') return { check: AddressBookAddressCheck.Empty, kind: null, duplicate: null }
  const kind = addressBookKind(address, network)
  if (kind == null) return { check: AddressBookAddressCheck.Invalid, kind: null, duplicate: null }
  const key = addressBookKey(address)
  const duplicate = contacts.find(contact => contact.id !== editingId && addressBookKey(contact.address) === key) ?? null
  return { check: duplicate == null ? AddressBookAddressCheck.Valid : AddressBookAddressCheck.Duplicate, kind, duplicate }
}

export function matchesAddressUsage(usage: AddressUsage, balance: bigint | null, used: boolean): boolean {
  if (usage === AddressUsage.Used) return used
  if (usage === AddressUsage.Balance) return balance == null || balance > 0n
  return true
}

export function matchesWalletAddressQuery(address: string, savedName: string | undefined, query: string): boolean {
  const needle = query.trim().toLowerCase()
  return needle === '' || address.toLowerCase().includes(needle) || (savedName?.toLowerCase().includes(needle) ?? false)
}
