import { describe, expect, it } from 'vitest'
import {
  contactDisplayName,
  contactLastActivity,
  contactRowModel,
  contactsForIdentity,
  countContactSegments,
  filterContacts,
  groupContactRows,
  isPayable,
  searchResultState,
  sortContacts,
} from '../../src/renderer/src/utils/dashPayContactList'
import { ContactSegment, ContactSort, DashPayContactRelationship, SearchResultState } from '../../src/renderer/src/enums/DashPay'
import type { DashPayContactDto } from '../../src/renderer/src/api/types'

const ME = 'MyIdentity'

function contact(contactId: string, relationship: DashPayContactRelationship, options: Partial<DashPayContactDto> = {}): DashPayContactDto {
  return {
    identifier: ME,
    contactId,
    relationship,
    aliasesList: [],
    incomingCreatedAt: relationship === DashPayContactRelationship.Outgoing ? null : 1_000,
    outgoingCreatedAt: relationship === DashPayContactRelationship.Incoming ? null : 1_000,
    paymentChannelBroken: false,
    ...options,
  }
}

const { Incoming, Outgoing, Established } = DashPayContactRelationship

const alice = contact('AliceId', Established, { aliasesList: ['alice.dash', 'alice-pay.dash'], incomingCreatedAt: 5_000, outgoingCreatedAt: 9_000 })
const bob = contact('BobId', Established, { aliasesList: ['Bob.dash'], incomingCreatedAt: 3_000, outgoingCreatedAt: 2_000 })
const carol = contact('CarolId', Incoming, { aliasesList: ['carol01.dash'], incomingCreatedAt: 7_000 })
const dave = contact('DaveId', Outgoing, { aliasesList: ['dave42.dash'], outgoingCreatedAt: 8_000 })
const digits = contact('DigitId', Established, { aliasesList: ['42ndstreet.dash'], incomingCreatedAt: 4_000, outgoingCreatedAt: 4_000 })
const unnamed = contact('7Hh2aRfK1sdP', Established, { incomingCreatedAt: 6_000, outgoingCreatedAt: 1_000 })
const all = [alice, bob, carol, dave, digits, unnamed]

describe('contactsForIdentity', () => {
  it('keeps only the rows of the acting identity', () => {
    const other = { ...alice, identifier: 'OtherIdentity' }
    expect(contactsForIdentity([alice, other, bob], ME)).toEqual([alice, bob])
  })
})

describe('contact presentation', () => {
  it('uses the oldest name, or a short identifier when there is none', () => {
    expect(contactDisplayName(alice)).toBe('alice.dash')
    expect(contactDisplayName(contact('4hTq9UuWXYZkPz2mK', Incoming))).toBe('4hTq9…Pz2mK')
  })

  it('dates activity by the later request either way', () => {
    expect(contactLastActivity(alice)).toBe(9_000)
    expect(contactLastActivity(contact('x', Incoming, { incomingCreatedAt: 42 }))).toBe(42)
  })

  it('pays only established contacts with a working channel', () => {
    expect(isPayable(alice)).toBe(true)
    expect(isPayable(carol)).toBe(false)
    expect(isPayable(dave)).toBe(false)
    expect(isPayable({ ...alice, paymentChannelBroken: true })).toBe(false)
  })

  it('builds the row model with extra names and own-identity flag', () => {
    expect(contactRowModel(alice, new Set(['AliceId']))).toEqual({
      contact: alice,
      name: 'alice.dash',
      extraNames: 1,
      isWalletIdentity: true,
      payable: true,
      lastActivity: 9_000,
    })
    expect(contactRowModel(unnamed, new Set())).toMatchObject({ name: null, extraNames: 0, isWalletIdentity: false })
  })
})

describe('filterContacts', () => {
  it('matches any alias homograph-insensitively and an identifier substring', () => {
    expect(filterContacts(all, 'ALICE-PAY').map(entry => entry.contactId)).toEqual(['AliceId'])
    expect(filterContacts(all, 'car0l').map(entry => entry.contactId)).toEqual(['CarolId'])
    expect(filterContacts(all, 'K1sd').map(entry => entry.contactId)).toEqual(['7Hh2aRfK1sdP'])
  })
})

describe('countContactSegments', () => {
  it('counts each relationship among the contacts matching the query', () => {
    expect(countContactSegments(all, '')).toEqual({
      [ContactSegment.All]: 6,
      [ContactSegment.Contacts]: 4,
      [ContactSegment.Requests]: 1,
      [ContactSegment.Sent]: 1,
    })
    expect(countContactSegments(all, 'da')).toEqual({
      [ContactSegment.All]: 1,
      [ContactSegment.Contacts]: 0,
      [ContactSegment.Requests]: 0,
      [ContactSegment.Sent]: 1,
    })
  })
})

describe('sortContacts', () => {
  it('orders by the latest activity, oldest first, or by name with names first', () => {
    expect(sortContacts(all, ContactSort.Recent).map(entry => entry.contactId))
      .toEqual(['AliceId', 'DaveId', 'CarolId', '7Hh2aRfK1sdP', 'DigitId', 'BobId'])
    expect(sortContacts(all, ContactSort.Oldest).map(entry => entry.contactId))
      .toEqual(['BobId', 'DigitId', '7Hh2aRfK1sdP', 'CarolId', 'DaveId', 'AliceId'])
    expect(sortContacts(all, ContactSort.Name).map(entry => entry.contactId))
      .toEqual(['DigitId', 'AliceId', 'BobId', 'CarolId', 'DaveId', '7Hh2aRfK1sdP'])
  })
})

describe('groupContactRows', () => {
  it('groups All into Requests, Contacts and Sent', () => {
    const groups = groupContactRows(all, ContactSegment.All, ContactSort.Recent)
    expect(groups.map(group => [group.label, group.total])).toEqual([['Requests', 1], ['Contacts', 4], ['Sent', 1]])
    expect(groups[1].items.map(entry => entry.contactId)).toEqual(['AliceId', '7Hh2aRfK1sdP', 'DigitId', 'BobId'])
  })

  it('leaves a single segment ungrouped unless sorted by name', () => {
    const groups = groupContactRows(all, ContactSegment.Contacts, ContactSort.Recent)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBeNull()
    expect(groups[0].total).toBe(4)
    expect(groupContactRows(all, ContactSegment.Sent, ContactSort.Oldest)[0].items).toEqual([dave])
  })

  it('groups a name sort by letter, then digits, then names last', () => {
    const groups = groupContactRows(all, ContactSegment.All, ContactSort.Name)
    expect(groups.map(group => group.label)).toEqual(['A', 'B', 'C', 'D', '#', 'No username'])
    expect(groups.find(group => group.label === '#')?.items).toEqual([digits])
  })

  it('returns no groups for an empty segment', () => {
    expect(groupContactRows([alice], ContactSegment.Requests, ContactSort.Recent)).toEqual([])
  })
})

describe('searchResultState', () => {
  const walletIds = new Set([ME, 'BobId', 'OwnSpare'])

  it('names the acting identity, existing relationships, own identities and strangers', () => {
    expect(searchResultState({ identifier: ME }, ME, all, walletIds)).toBe(SearchResultState.Self)
    expect(searchResultState({ identifier: 'AliceId' }, ME, all, walletIds)).toBe(SearchResultState.Contact)
    expect(searchResultState({ identifier: 'DaveId' }, ME, all, walletIds)).toBe(SearchResultState.Sent)
    expect(searchResultState({ identifier: 'CarolId' }, ME, all, walletIds)).toBe(SearchResultState.Incoming)
    expect(searchResultState({ identifier: 'OwnSpare' }, ME, all, walletIds)).toBe(SearchResultState.YourIdentity)
    expect(searchResultState({ identifier: 'Stranger' }, ME, all, walletIds)).toBe(SearchResultState.None)
  })

  it('lets a relationship win over own-identity, and scopes it to the acting identity', () => {
    expect(searchResultState({ identifier: 'BobId' }, ME, all, walletIds)).toBe(SearchResultState.Contact)
    expect(searchResultState({ identifier: 'AliceId' }, 'OwnSpare', all, walletIds)).toBe(SearchResultState.None)
  })
})
