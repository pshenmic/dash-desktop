import type { Network } from '../api/types'
import {
  ADDRESS_BOOK_COPY,
  ADDRESS_BOOK_COUNT_SEPARATOR,
  ADDRESS_BOOK_PARAMS,
  ADDRESS_BOOK_ROUTES,
  ADDRESS_BOOK_SEGMENT_LABELS,
  ADDRESS_BOOK_SEGMENT_ORDER,
  ENTRY_EDIT_COPY,
  REMOVE_ENTRY_COPY,
} from '../constants/addressBook'
import { SEND_PARAMS, SEND_ROUTE } from '../constants/sendPages'
import type { AddressBookSegment, AddressUsage, WalletAddressTab } from '../enums/AddressBook'
import { DestinationKind } from '../enums/DestinationKind'
import type { AddressBookKind, AddressBookSegmentCounts } from '../types/AddressBook'
import type { SegmentOption } from '../types/SegmentedControl'
import { addressUrl, identityUrl, platformAddressUrl } from './explorer'
import { withParams } from './searchParams'

export function entryExplorerUrl(kind: AddressBookKind, address: string, network: Network): string | null {
  switch (kind) {
    case DestinationKind.CoreAddress:
      return addressUrl(address, network)
    case DestinationKind.PlatformAddress:
      return platformAddressUrl(address, network)
    case DestinationKind.Identity:
      return identityUrl(address, network)
    case DestinationKind.Shielded:
      return null
  }
}

export function addressBookSegmentOptions(counts: AddressBookSegmentCounts): SegmentOption<AddressBookSegment>[] {
  return ADDRESS_BOOK_SEGMENT_ORDER.map(segment => ({
    value: segment,
    label: `${ADDRESS_BOOK_SEGMENT_LABELS[segment]}${ADDRESS_BOOK_COUNT_SEPARATOR}${counts[segment]}`,
  }))
}

export function addressBookNoMatchLabel(query: string): string {
  return `${ADDRESS_BOOK_COPY.noMatchLead} "${query}"`
}

export function addressBookShowAllLabel(count: number): string {
  return `${ADDRESS_BOOK_COPY.showAll}${ADDRESS_BOOK_COUNT_SEPARATOR}${count}`
}

export function addressBookSendHref(kind: AddressBookKind, address: string): string {
  return `${SEND_ROUTE}?${withParams('', { [SEND_PARAMS.to]: kind, [SEND_PARAMS.recipient]: address })}`
}

export function invalidEntryAddressMessage(network: Network | undefined): string {
  return [ENTRY_EDIT_COPY.invalidLead, network, ENTRY_EDIT_COPY.invalidTail].filter(Boolean).join(' ')
}

export function duplicateEntryMessage(label: string): string {
  return `${ENTRY_EDIT_COPY.duplicateLead} “${label}”`
}

export function removeEntryTitle(label: string): string {
  return `${REMOVE_ENTRY_COPY.titlePrefix} “${label}”?`
}

export function walletAddressesHref(tab: WalletAddressTab, usage?: AddressUsage): string {
  return `${ADDRESS_BOOK_ROUTES.wallet}?${withParams('', { [ADDRESS_BOOK_PARAMS.tab]: tab, [ADDRESS_BOOK_PARAMS.usage]: usage })}`
}
