import { describe, expect, it } from 'vitest'
import { matchingContacts } from '../../src/renderer/src/utils/matchingContacts'
import type { Contact } from '../../src/renderer/src/api/types'

const contacts: Contact[] = [
  {id: 1, label: 'Alice', address: 'yAliceAddress', network: 'testnet', createdAt: 0},
  {id: 2, label: 'Bob', address: 'yBobAddress', network: 'testnet', createdAt: 0},
  {id: 3, label: 'Carol', address: 'tdash1carol', network: 'testnet', createdAt: 0},
]
const startsWithY = (address: string): boolean => address.startsWith('y')

describe('matchingContacts', () => {
  it('lists every valid contact for an empty query', () => {
    expect(matchingContacts(contacts, '  ', startsWithY).map(contact => contact.id)).toEqual([1, 2])
  })

  it('matches the trimmed query against address or name, ignoring case', () => {
    expect(matchingContacts(contacts, ' bob ', startsWithY).map(contact => contact.id)).toEqual([2])
    expect(matchingContacts(contacts, 'ALICEADD', startsWithY).map(contact => contact.id)).toEqual([1])
  })

  it('hides contacts the destination cannot accept even when they match', () => {
    expect(matchingContacts(contacts, 'carol', startsWithY)).toEqual([])
    expect(matchingContacts(contacts, 'carol', () => true).map(contact => contact.id)).toEqual([3])
  })
})
