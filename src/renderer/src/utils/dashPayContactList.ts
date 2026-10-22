import type { AliasSearchResultDto, DashPayContactDto } from '@renderer/api/types'
import {
  CONTACT_DIGIT_PATTERN,
  CONTACT_GROUP_LABELS,
  CONTACT_GROUP_ORDER,
  CONTACT_LETTER_GROUP_TAIL,
  CONTACT_SEGMENT_LABELS,
  RELATIONSHIP_SEGMENTS,
  SEARCH_STATE_BY_RELATIONSHIP,
} from '@renderer/constants/dashPay'
import { NAME_COLLATOR } from '@renderer/constants/listToolbar'
import { ContactSegment, ContactSort, DashPayContactRelationship, SearchResultState } from '@renderer/enums/DashPay'
import type { ContactGroup, ContactRowModel, ContactSegmentCounts } from '@renderer/types/DashPay'
import { matchesIdentityQuery } from './dpnsLabel'
import { shortIdentifier } from './identifierFormat'

export function contactsForIdentity(contacts: DashPayContactDto[], identifier: string): DashPayContactDto[] {
  return contacts.filter(contact => contact.identifier === identifier)
}

export function contactDisplayName(contact: DashPayContactDto): string {
  return contact.aliasesList[0] ?? shortIdentifier(contact.contactId)
}

export function contactLastActivity(contact: DashPayContactDto): number {
  return Math.max(contact.incomingCreatedAt ?? 0, contact.outgoingCreatedAt ?? 0)
}

export function isPayable(contact: DashPayContactDto): boolean {
  return contact.relationship === DashPayContactRelationship.Established && !contact.paymentChannelBroken
}

export function contactRowModel(contact: DashPayContactDto, walletIdentifiers: ReadonlySet<string>): ContactRowModel {
  return {
    contact,
    name: contact.aliasesList[0] ?? null,
    extraNames: Math.max(0, contact.aliasesList.length - 1),
    isWalletIdentity: walletIdentifiers.has(contact.contactId),
    payable: isPayable(contact),
    lastActivity: contactLastActivity(contact),
  }
}

export function filterContacts(contacts: DashPayContactDto[], query: string): DashPayContactDto[] {
  return contacts.filter(contact => matchesIdentityQuery(contact.contactId, contact.aliasesList, query))
}

function compareContactNames(a: DashPayContactDto, b: DashPayContactDto): number {
  const nameA = a.aliasesList[0]
  const nameB = b.aliasesList[0]
  if (nameA != null && nameB == null) return -1
  if (nameA == null && nameB != null) return 1
  const byName = nameA != null && nameB != null ? NAME_COLLATOR.compare(nameA, nameB) : 0
  return byName !== 0 ? byName : a.contactId.localeCompare(b.contactId)
}

function compareContacts(a: DashPayContactDto, b: DashPayContactDto, sort: ContactSort): number {
  if (sort === ContactSort.Name) return compareContactNames(a, b)
  const elapsed = contactLastActivity(a) - contactLastActivity(b)
  const ordered = sort === ContactSort.Oldest ? elapsed : -elapsed
  return ordered !== 0 ? ordered : a.contactId.localeCompare(b.contactId)
}

export function sortContacts(contacts: DashPayContactDto[], sort: ContactSort): DashPayContactDto[] {
  return [...contacts].sort((a, b) => compareContacts(a, b, sort))
}

export function countContactSegments(contacts: DashPayContactDto[], query: string): ContactSegmentCounts {
  const matched = filterContacts(contacts, query)
  const counts: ContactSegmentCounts = {
    [ContactSegment.All]: matched.length,
    [ContactSegment.Contacts]: 0,
    [ContactSegment.Requests]: 0,
    [ContactSegment.Sent]: 0,
  }
  for (const contact of matched) counts[RELATIONSHIP_SEGMENTS[contact.relationship]] += 1
  return counts
}

function letterKey(contact: DashPayContactDto): string {
  const name = contact.aliasesList[0]
  if (name == null) return CONTACT_GROUP_LABELS.noUsername
  const first = name.charAt(0).toUpperCase()
  return CONTACT_DIGIT_PATTERN.test(first) ? CONTACT_GROUP_LABELS.digits : first
}

function letterGroups(sorted: DashPayContactDto[]): ContactGroup[] {
  const groups = new Map<string, DashPayContactDto[]>()
  for (const contact of sorted) {
    const key = letterKey(contact)
    const items = groups.get(key) ?? []
    items.push(contact)
    groups.set(key, items)
  }
  const rank = (key: string): number => CONTACT_LETTER_GROUP_TAIL.indexOf(key)
  return Array.from(groups, ([key, items]) => ({ key, label: key, items, total: items.length }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))
}

export function groupContactRows(contacts: DashPayContactDto[], segment: ContactSegment, sort: ContactSort): ContactGroup[] {
  const inSegment = segment === ContactSegment.All
    ? contacts
    : contacts.filter(contact => RELATIONSHIP_SEGMENTS[contact.relationship] === segment)
  const sorted = sortContacts(inSegment, sort)
  if (sort === ContactSort.Name) return letterGroups(sorted)
  if (segment !== ContactSegment.All) {
    return sorted.length === 0 ? [] : [{ key: segment, label: null, items: sorted, total: sorted.length }]
  }
  return CONTACT_GROUP_ORDER
    .map(groupSegment => {
      const items = sorted.filter(contact => RELATIONSHIP_SEGMENTS[contact.relationship] === groupSegment)
      return { key: groupSegment, label: CONTACT_SEGMENT_LABELS[groupSegment], items, total: items.length }
    })
    .filter(group => group.items.length > 0)
}

export function searchResultState(
  result: Pick<AliasSearchResultDto, 'identifier'>,
  actingIdentifier: string,
  contacts: DashPayContactDto[],
  walletIdentifiers: ReadonlySet<string>,
): SearchResultState {
  if (result.identifier === actingIdentifier) return SearchResultState.Self
  const contact = contacts.find(entry => entry.identifier === actingIdentifier && entry.contactId === result.identifier)
  if (contact != null) return SEARCH_STATE_BY_RELATIONSHIP[contact.relationship]
  return walletIdentifiers.has(result.identifier) ? SearchResultState.YourIdentity : SearchResultState.None
}
