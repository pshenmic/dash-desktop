import type { DashPayContactDto } from '@renderer/api/types'
import { CONTACT_SEGMENT_LABELS } from '@renderer/constants/dashPay'
import {
  CONTACT_COPY_SEPARATOR,
  CONTACT_DETAIL_COPY,
  CONTACT_ROW_COPY,
  CONTACT_SEGMENT_ORDER,
  CONTACTS_TAB_COPY,
  DASH_AMOUNT_INPUT_PATTERN,
  PAY_CONTACT_COPY,
} from '@renderer/constants/dashPayContacts'
import { ContactSegment, DashPayContactRelationship } from '@renderer/enums/DashPay'
import type { ContactRowModel, ContactSegmentCounts } from '@renderer/types/DashPay'
import type { SegmentOption } from '@renderer/types/SegmentedControl'
import { contactLastActivity } from './dashPayContactList'
import { formatCreationDate } from './date'
import { formatAgo } from './timeLeft'

function requestTime(contact: DashPayContactDto, own: boolean): number {
  return (own ? contact.outgoingCreatedAt : contact.incomingCreatedAt) ?? contactLastActivity(contact)
}

export function contactRowMeta(contact: DashPayContactDto, now: number): string {
  if (contact.relationship === DashPayContactRelationship.Incoming) {
    return `${CONTACT_ROW_COPY.wantsToAdd}${CONTACT_COPY_SEPARATOR}${formatAgo(requestTime(contact, false), now)}`
  }
  if (contact.relationship === DashPayContactRelationship.Outgoing) {
    return `${CONTACT_ROW_COPY.requestSent}${CONTACT_COPY_SEPARATOR}${formatAgo(requestTime(contact, true), now)}`
  }
  return `${CONTACT_ROW_COPY.since} ${formatCreationDate(new Date(contactLastActivity(contact)))}`
}

export function contactRowCaption(model: ContactRowModel, now: number): string {
  const lead = model.name == null ? CONTACT_ROW_COPY.noUsername : model.contact.contactId
  return `${lead}${CONTACT_COPY_SEPARATOR}${contactRowMeta(model.contact, now)}`
}

export function extraNamesLabel(count: number): string {
  return `${CONTACT_ROW_COPY.extraPrefix}${count}`
}

export function contactSegmentOptions(counts: ContactSegmentCounts): SegmentOption<ContactSegment>[] {
  return CONTACT_SEGMENT_ORDER.map(segment => ({
    value: segment,
    label: `${CONTACT_SEGMENT_LABELS[segment]}${CONTACT_COPY_SEPARATOR}${counts[segment]}`,
  }))
}

export function contactGroupLabel(label: string, total: number): string {
  return `${label}${CONTACT_COPY_SEPARATOR}${total}`
}

export function contactsNoMatchLabel(query: string, identityName: string | null): string {
  const lead = `${CONTACTS_TAB_COPY.noMatchLead} "${query}"`
  return identityName == null ? lead : `${lead} ${CONTACTS_TAB_COPY.noMatchFor} ${identityName}`
}

export function showInAllLabel(count: number): string {
  return `${CONTACTS_TAB_COPY.showLead} ${count} ${CONTACTS_TAB_COPY.inAll}`
}

export function contactDetailSubtitle(contact: DashPayContactDto, identityName: string, now: number): string {
  if (contact.relationship === DashPayContactRelationship.Incoming) {
    return `${CONTACT_DETAIL_COPY.wantsToAdd} ${identityName}${CONTACT_COPY_SEPARATOR}${formatAgo(requestTime(contact, false), now)}`
  }
  if (contact.relationship === DashPayContactRelationship.Outgoing) {
    return `${CONTACT_DETAIL_COPY.requestSentFrom} ${identityName}${CONTACT_COPY_SEPARATOR}${formatCreationDate(new Date(requestTime(contact, true)))}`
  }
  const since = formatCreationDate(new Date(contactLastActivity(contact)))
  return `${CONTACT_DETAIL_COPY.contactOf} ${identityName}${CONTACT_COPY_SEPARATOR}${CONTACT_DETAIL_COPY.since} ${since}`
}

export function contactOtherNames(aliases: string[], limit: number): string | null {
  const others = aliases.slice(1)
  if (others.length === 0) return null
  const shown = `${CONTACT_DETAIL_COPY.also} ${others.slice(0, limit).join(', ')}`
  const hidden = others.length - limit
  return hidden > 0 ? `${shown} ${extraNamesLabel(hidden)} ${CONTACT_DETAIL_COPY.more}` : shown
}

export function brokenChannelDescription(contactName: string): string {
  return `${CONTACT_DETAIL_COPY.brokenLead} ${contactName} ${CONTACT_DETAIL_COPY.brokenTail}`
}

export function isDashAmountInput(value: string): boolean {
  return value === '' || DASH_AMOUNT_INPUT_PATTERN.test(value)
}

export function payDoneNote(contactName: string, identityName: string): string {
  return `${PAY_CONTACT_COPY.to} ${contactName}${CONTACT_COPY_SEPARATOR}${PAY_CONTACT_COPY.from} ${identityName}${PAY_CONTACT_COPY.contactsSuffix}`
}
