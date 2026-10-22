import {bech32m, createBase58check} from '@scure/base'
import {sha256} from '@noble/hashes/sha2.js'
import {describe, expect, it} from 'vitest'
import type {Contact} from '../../src/renderer/src/api/types'
import {AddressBookAddressCheck, AddressBookSegment, AddressBookSort, AddressUsage} from '../../src/renderer/src/enums/AddressBook'
import {DestinationKind} from '../../src/renderer/src/enums/DestinationKind'
import type {OwnRecipientInventory} from '../../src/renderer/src/types/SendRecipients'
import {
  addressBookAddressStatus,
  addressBookEntries,
  addressBookKey,
  addressBookKind,
  countAddressBookSegments,
  filterAddressBook,
  matchesAddressUsage,
  matchesWalletAddressQuery,
  savedNamesByAddress,
  sortAddressBook,
  walletAddressSet,
} from '../../src/renderer/src/utils/addressBook'

const testnetCore = createBase58check(sha256).encode(Uint8Array.from([140, ...Array(20).fill(1)]))
const mainnetCore = createBase58check(sha256).encode(Uint8Array.from([76, ...Array(20).fill(1)]))
const testnetPlatform = bech32m.encode('tdash', bech32m.toWords(Uint8Array.from([0xb0, ...Array(20).fill(1)])))
const identityId = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'
const shielded = `tdash1${'q'.repeat(70)}`

function contact(id: number, label: string, address: string, createdAt = id): Contact {
  return {id, label, address, network: 'testnet', createdAt}
}

const book = [
  contact(1, 'Bob', testnetCore, 30),
  contact(2, 'alice', testnetPlatform, 10),
  contact(3, 'Carol', identityId, 20),
  contact(4, 'Dave', shielded, 40),
  contact(5, 'Old', mainnetCore, 5),
]

describe('addressBookKind', () => {
  it('detects every saved entry type for the active network', () => {
    expect(addressBookKind(` ${testnetCore} `, 'testnet')).toBe(DestinationKind.CoreAddress)
    expect(addressBookKind(testnetPlatform, 'testnet')).toBe(DestinationKind.PlatformAddress)
    expect(addressBookKind(identityId, 'testnet')).toBe(DestinationKind.Identity)
    expect(addressBookKind(shielded, 'testnet')).toBe(DestinationKind.Shielded)
  })

  it('rejects empty values and addresses from another network', () => {
    expect(addressBookKind('  ', 'testnet')).toBeNull()
    expect(addressBookKind(mainnetCore, 'testnet')).toBeNull()
    expect(addressBookKind(testnetPlatform, 'mainnet')).toBeNull()
    expect(addressBookKind('not an address', 'testnet')).toBeNull()
  })
})

describe('addressBookKey', () => {
  it('lowercases bech32m addresses only', () => {
    expect(addressBookKey(` ${testnetPlatform.toUpperCase()} `)).toBe(testnetPlatform)
    expect(addressBookKey(shielded.toUpperCase())).toBe(shielded)
    expect(addressBookKey(` ${testnetCore} `)).toBe(testnetCore)
    expect(addressBookKey(identityId)).toBe(identityId)
  })
})

describe('walletAddressSet', () => {
  it('collects every wallet address and identity as lookup keys', () => {
    const inventory = {
      receiving: [{address: testnetCore}],
      change: [{address: ''}],
      platformAddresses: [{platformAddress: testnetPlatform.toUpperCase()}],
      identities: [{identifier: identityId}],
      shieldedAddresses: [],
      shieldedNotes: [{address: shielded}],
    } as unknown as OwnRecipientInventory
    expect(walletAddressSet(inventory)).toEqual(new Set([testnetCore, testnetPlatform, identityId, shielded]))
    expect(walletAddressSet({...inventory, shieldedNotes: null}).has(shielded)).toBe(false)
  })
})

describe('address book list', () => {
  const entries = addressBookEntries(book, 'testnet', new Set([identityId]))

  it('builds entries with their type and wallet ownership', () => {
    expect(entries.map(entry => [entry.contact.id, entry.kind, entry.owned])).toEqual([
      [1, DestinationKind.CoreAddress, false],
      [2, DestinationKind.PlatformAddress, false],
      [3, DestinationKind.Identity, true],
      [4, DestinationKind.Shielded, false],
      [5, null, false],
    ])
  })

  it('counts each segment for the current search, keeping unrecognized entries in All only', () => {
    expect(countAddressBookSegments(entries, '')).toEqual({
      [AddressBookSegment.All]: 5,
      [AddressBookSegment.Core]: 1,
      [AddressBookSegment.Platform]: 1,
      [AddressBookSegment.Identities]: 1,
      [AddressBookSegment.Shielded]: 1,
    })
    expect(countAddressBookSegments(entries, 'AL')[AddressBookSegment.All]).toBe(1)
  })

  it('filters by segment and by name or address', () => {
    expect(filterAddressBook(entries, '', AddressBookSegment.Identities).map(entry => entry.contact.id)).toEqual([3])
    expect(filterAddressBook(entries, testnetCore.slice(3, 12), AddressBookSegment.All).map(entry => entry.contact.id)).toEqual([1])
    expect(filterAddressBook(entries, 'carol', AddressBookSegment.Core)).toEqual([])
  })

  it('sorts by name case-insensitively or by most recently added', () => {
    expect(sortAddressBook(entries, AddressBookSort.Name).map(entry => entry.contact.label)).toEqual(['alice', 'Bob', 'Carol', 'Dave', 'Old'])
    expect(sortAddressBook(entries, AddressBookSort.Recent).map(entry => entry.contact.id)).toEqual([4, 1, 3, 2, 5])
  })

  it('maps saved names by lookup key', () => {
    expect(savedNamesByAddress(book).get(testnetPlatform)).toBe('alice')
  })
})

describe('addressBookAddressStatus', () => {
  it('reports empty, invalid, duplicate and valid input', () => {
    expect(addressBookAddressStatus(' ', 'testnet', book, null).check).toBe(AddressBookAddressCheck.Empty)
    expect(addressBookAddressStatus(mainnetCore, 'testnet', book, null).check).toBe(AddressBookAddressCheck.Invalid)
    expect(addressBookAddressStatus(testnetPlatform.toUpperCase(), 'testnet', book, null)).toMatchObject({
      check: AddressBookAddressCheck.Duplicate,
      kind: DestinationKind.PlatformAddress,
      duplicate: {id: 2},
    })
    expect(addressBookAddressStatus(testnetPlatform, 'testnet', book, 2)).toEqual({
      check: AddressBookAddressCheck.Valid,
      kind: DestinationKind.PlatformAddress,
      duplicate: null,
    })
  })
})

describe('wallet address filters', () => {
  it('matches usage, keeping unknown balances under With balance', () => {
    expect(matchesAddressUsage(AddressUsage.All, 0n, false)).toBe(true)
    expect(matchesAddressUsage(AddressUsage.Used, 0n, false)).toBe(false)
    expect(matchesAddressUsage(AddressUsage.Used, 0n, true)).toBe(true)
    expect(matchesAddressUsage(AddressUsage.Balance, 0n, true)).toBe(false)
    expect(matchesAddressUsage(AddressUsage.Balance, 5n, false)).toBe(true)
    expect(matchesAddressUsage(AddressUsage.Balance, null, false)).toBe(true)
  })

  it('matches the address or its saved name', () => {
    expect(matchesWalletAddressQuery(testnetCore, 'Savings', 'sav')).toBe(true)
    expect(matchesWalletAddressQuery(testnetCore, undefined, testnetCore.slice(5, 10).toLowerCase())).toBe(true)
    expect(matchesWalletAddressQuery(testnetCore, undefined, 'savings')).toBe(false)
    expect(matchesWalletAddressQuery(testnetCore, undefined, ' ')).toBe(true)
  })
})
