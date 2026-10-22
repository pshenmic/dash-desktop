import { describe, expect, it } from 'vitest'
import type { DashPayContactDto } from '@renderer/api/types'
import { ContactSegment, DashPayContactRelationship } from '@renderer/enums/DashPay'
import { contactRowModel } from '@renderer/utils/dashPayContactList'
import {
  brokenChannelDescription,
  contactDetailSubtitle,
  contactGroupLabel,
  contactOtherNames,
  contactRowCaption,
  contactRowMeta,
  contactSegmentOptions,
  contactsNoMatchLabel,
  creditShortfall,
  extraNamesLabel,
  isDashAmountInput,
  payDoneNote,
  showInAllLabel,
} from '@renderer/utils/dashPayContactView'
import { shortIdentifier } from '@renderer/utils/identifierFormat'

const NOW = Date.UTC(2026, 9, 22, 12, 0, 0)
const HOUR = 3_600_000
const DAY = 24 * HOUR
const CONTACT_ID = 'DcoJJ1111111111111111111111111111111XyZ9'

function contact(overrides: Partial<DashPayContactDto> = {}): DashPayContactDto {
  return {
    identifier: '7cBLv1111111111111111111111111111111Fh9n',
    contactId: CONTACT_ID,
    relationship: DashPayContactRelationship.Established,
    aliasesList: ['alice.dash'],
    incomingCreatedAt: Date.UTC(2026, 9, 12, 9, 0, 0),
    outgoingCreatedAt: Date.UTC(2026, 9, 10, 9, 0, 0),
    paymentChannelBroken: false,
    ...overrides,
  }
}

describe('contact row copy', () => {
  it('describes each relationship', () => {
    expect(contactRowMeta(contact(), NOW)).toBe('Since 12 Oct 2026')
    expect(contactRowMeta(contact({ relationship: DashPayContactRelationship.Incoming, incomingCreatedAt: NOW - 2 * HOUR, outgoingCreatedAt: null }), NOW))
      .toBe('Wants to add you · 2h ago')
    expect(contactRowMeta(contact({ relationship: DashPayContactRelationship.Outgoing, incomingCreatedAt: null, outgoingCreatedAt: NOW - 5 * DAY }), NOW))
      .toBe('Request sent · 5d ago')
  })

  it('leads with the short identifier, or No username when unnamed', () => {
    const named = contactRowModel(contact(), new Set())
    const unnamed = contactRowModel(contact({ aliasesList: [] }), new Set())
    expect(contactRowCaption(named, NOW)).toBe(`${shortIdentifier(CONTACT_ID)} · Since 12 Oct 2026`)
    expect(contactRowCaption(unnamed, NOW)).toBe('No username · Since 12 Oct 2026')
  })

  it('keeps a hundred names compact', () => {
    expect(extraNamesLabel(99)).toBe('+99')
    const names = Array.from({ length: 100 }, (_, index) => `name${index}.dash`)
    expect(contactOtherNames(names, 3)).toBe('also name1.dash, name2.dash, name3.dash +96 more')
    expect(contactOtherNames(['a.dash', 'b.dash'], 3)).toBe('also b.dash')
    expect(contactOtherNames(['a.dash'], 3)).toBeNull()
  })
})

describe('contact list labels', () => {
  it('labels segments with live counts in toolbar order', () => {
    const options = contactSegmentOptions({
      [ContactSegment.All]: 214,
      [ContactSegment.Contacts]: 186,
      [ContactSegment.Requests]: 12,
      [ContactSegment.Sent]: 16,
    })
    expect(options.map(option => option.label)).toEqual(['All · 214', 'Contacts · 186', 'Requests · 12', 'Sent · 16'])
    expect(options.map(option => option.value)).toEqual([ContactSegment.All, ContactSegment.Contacts, ContactSegment.Requests, ContactSegment.Sent])
  })

  it('names the identity in the no-match state', () => {
    expect(contactGroupLabel('Requests', 12)).toBe('Requests · 12')
    expect(contactsNoMatchLabel('alice', '7cBLv…Fh9n')).toBe('No contacts match "alice" for 7cBLv…Fh9n')
    expect(showInAllLabel(3)).toBe('Show 3 in All')
  })
})

describe('contact detail copy', () => {
  it('describes the relationship from the acting identity', () => {
    expect(contactDetailSubtitle(contact(), 'owl352.dash', NOW)).toBe('Contact of owl352.dash · since 12 Oct 2026')
    expect(contactDetailSubtitle(contact({ relationship: DashPayContactRelationship.Incoming, incomingCreatedAt: NOW - 3 * DAY, outgoingCreatedAt: null }), 'owl352.dash', NOW))
      .toBe('Wants to add owl352.dash · 3d ago')
    expect(contactDetailSubtitle(contact({ relationship: DashPayContactRelationship.Outgoing, incomingCreatedAt: null }), 'owl352.dash', NOW))
      .toBe('Request sent from owl352.dash · 10 Oct 2026')
    expect(brokenChannelDescription('alice.dash')).toBe('Ask alice.dash to send you a new contact request.')
    expect(payDoneNote('alice.dash', 'owl352.dash')).toBe('To alice.dash · from owl352.dash’s contacts')
  })
})

describe('amount and fee checks', () => {
  it('accepts up to eight decimals', () => {
    expect(isDashAmountInput('')).toBe(true)
    expect(isDashAmountInput('0.12345678')).toBe(true)
    expect(isDashAmountInput('.5')).toBe(true)
    expect(isDashAmountInput('0.123456789')).toBe(false)
    expect(isDashAmountInput('1.2.3')).toBe(false)
    expect(isDashAmountInput('abc')).toBe(false)
  })

  it('reports a shortfall only when the fee exceeds the balance', () => {
    expect(creditShortfall(100n, null)).toBeNull()
    expect(creditShortfall(100n, 100n)).toBeNull()
    expect(creditShortfall(100n, 250n)).toBe(150n)
  })
})
