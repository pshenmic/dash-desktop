import { describe, expect, it } from 'vitest'
import {
  addContactRows,
  usernameSearchPrefix,
  identifierResultRow,
  isUsernameSearchCapped,
  isSelectableResult,
  resultRowLabel,
} from '../../src/renderer/src/utils/dashPayAddContact'
import { USERNAME_SEARCH_RESULT_CAP } from '../../src/renderer/src/constants/dashPay'
import { DashPayContactRelationship, SearchResultState } from '../../src/renderer/src/enums/DashPay'
import type { UsernameSearchResultDto, DashPayContactDto } from '../../src/renderer/src/api/types'
import type { AddContactRowContext } from '../../src/renderer/src/types/DashPayAddContact'

const ME = 'MyIdentity'

function contact(contactId: string, relationship: DashPayContactRelationship, identifier = ME): DashPayContactDto {
  return {
    identifier,
    contactId,
    relationship,
    usernames: [],
    incomingCreatedAt: null,
    outgoingCreatedAt: null,
    paymentChannelBroken: false,
  }
}

const context: AddContactRowContext = {
  actingIdentifier: ME,
  contacts: [
    contact('AliceId', DashPayContactRelationship.Established),
    contact('CarolId', DashPayContactRelationship.Incoming),
    contact('DaveId', DashPayContactRelationship.Outgoing),
    contact('ErinId', DashPayContactRelationship.Established, 'OwnSpare'),
  ],
  walletIdentifiers: new Set([ME, 'OwnSpare']),
}

function result(identifier: string, name: string): UsernameSearchResultDto {
  return { identifier, name }
}

describe('usernameSearchPrefix', () => {
  it('strips the handle, the suffix and whitespace, then normalizes homographs', () => {
    expect(usernameSearchPrefix(' @Alice.dash ')).toBe('a11ce')
    expect(usernameSearchPrefix('Bob')).toBe('b0b')
    expect(usernameSearchPrefix('')).toBe('')
  })
})

describe('addContactRows', () => {
  it('collapses an identity with several names into one row counting the rest', () => {
    const rows = addContactRows([
      result('AliceId', 'alice.dash'),
      result('AliceId', 'alice-pay.dash'),
      result('ZedId', 'alicia.dash'),
      result('AliceId', 'alice-shop.dash'),
    ], context)
    expect(rows.map(row => [row.identifier, row.name, row.extraNames])).toEqual([
      ['AliceId', 'alice.dash', 2],
      ['ZedId', 'alicia.dash', 0],
    ])
  })

  it('assigns every search state against the acting identity', () => {
    const rows = addContactRows([
      result(ME, 'me.dash'),
      result('OwnSpare', 'spare.dash'),
      result('AliceId', 'alice.dash'),
      result('DaveId', 'dave.dash'),
      result('CarolId', 'carol.dash'),
      result('ErinId', 'erin.dash'),
    ], context)
    expect(rows.map(row => row.state)).toEqual([
      SearchResultState.Self,
      SearchResultState.YourIdentity,
      SearchResultState.Contact,
      SearchResultState.Sent,
      SearchResultState.Incoming,
      SearchResultState.None,
    ])
  })

  it('returns nothing for no results', () => {
    expect(addContactRows([], context)).toEqual([])
  })
})

describe('identifierResultRow', () => {
  it('builds one unnamed row from a pasted identifier', () => {
    expect(identifierResultRow('  DaveId ', context)).toEqual({
      identifier: 'DaveId',
      name: null,
      extraNames: 0,
      state: SearchResultState.Sent,
    })
    expect(identifierResultRow('StrangerId', context).state).toBe(SearchResultState.None)
  })
})

describe('isSelectableResult', () => {
  it('allows only strangers and other wallet identities', () => {
    const selectable = Object.values(SearchResultState).filter(isSelectableResult)
    expect(selectable).toEqual([SearchResultState.YourIdentity, SearchResultState.None])
  })
})

describe('isUsernameSearchCapped', () => {
  it('flags a page that reached the backend limit', () => {
    const page = (n: number): UsernameSearchResultDto[] => Array.from({ length: n }, (_, i) => result(`Id${i}`, `name${i}.dash`))
    expect(isUsernameSearchCapped(page(USERNAME_SEARCH_RESULT_CAP))).toBe(true)
    expect(isUsernameSearchCapped(page(USERNAME_SEARCH_RESULT_CAP - 1))).toBe(false)
    expect(isUsernameSearchCapped([])).toBe(false)
  })
})

describe('resultRowLabel', () => {
  it('uses the name, or the full identifier for a pasted ID', () => {
    expect(resultRowLabel({ identifier: 'AliceId', name: 'alice.dash' })).toBe('alice.dash')
    expect(resultRowLabel({ identifier: '7Hh2aRfK1sdPxq9W2mN4bT6cY8eJ3kL5pQ7rS9uV1wX', name: null })).toBe('7Hh2aRfK1sdPxq9W2mN4bT6cY8eJ3kL5pQ7rS9uV1wX')
  })
})
