import { describe, expect, it } from 'vitest'
import {
  addContactRows,
  aliasSearchPrefix,
  creditShortfall,
  identifierResultRow,
  isAliasSearchCapped,
  isSelectableResult,
  resultRowLabel,
} from '../../src/renderer/src/utils/dashPayAddContact'
import { ALIAS_SEARCH_RESULT_CAP } from '../../src/renderer/src/constants/dashPay'
import { DashPayContactRelationship, SearchResultState } from '../../src/renderer/src/enums/DashPay'
import type { AliasSearchResultDto, DashPayContactDto } from '../../src/renderer/src/api/types'
import type { AddContactRowContext } from '../../src/renderer/src/types/DashPayAddContact'

const ME = 'MyIdentity'

function contact(contactId: string, relationship: DashPayContactRelationship, identifier = ME): DashPayContactDto {
  return {
    identifier,
    contactId,
    relationship,
    aliasesList: [],
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

function result(identifier: string, name: string): AliasSearchResultDto {
  return { identifier, name }
}

describe('aliasSearchPrefix', () => {
  it('strips the handle, the suffix and whitespace, then normalizes homographs', () => {
    expect(aliasSearchPrefix(' @Alice.dash ')).toBe('a11ce')
    expect(aliasSearchPrefix('Bob')).toBe('b0b')
    expect(aliasSearchPrefix('')).toBe('')
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

describe('isAliasSearchCapped', () => {
  it('flags a page that reached the backend limit', () => {
    const page = (n: number): AliasSearchResultDto[] => Array.from({ length: n }, (_, i) => result(`Id${i}`, `name${i}.dash`))
    expect(isAliasSearchCapped(page(ALIAS_SEARCH_RESULT_CAP))).toBe(true)
    expect(isAliasSearchCapped(page(ALIAS_SEARCH_RESULT_CAP - 1))).toBe(false)
    expect(isAliasSearchCapped([])).toBe(false)
  })
})

describe('resultRowLabel', () => {
  it('uses the name, or the shortened identifier for a pasted ID', () => {
    expect(resultRowLabel({ identifier: 'AliceId', name: 'alice.dash' })).toBe('alice.dash')
    expect(resultRowLabel({ identifier: '7Hh2aRfK1sdPxq9W2mN4bT6cY8eJ3kL5pQ7rS9uV1wX', name: null })).toBe('Identity 7Hh2a…uV1wX')
  })
})

describe('creditShortfall', () => {
  it('returns the missing credits only when the balance cannot cover the fee', () => {
    expect(creditShortfall(100n, 250n)).toBe(150n)
    expect(creditShortfall(250n, 250n)).toBeNull()
    expect(creditShortfall(0n, null)).toBeNull()
  })
})
