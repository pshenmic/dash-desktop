import {describe, expect, it} from 'vitest'
import {AddressBookSegment, AddressUsage, WalletAddressTab} from '../../src/renderer/src/enums/AddressBook'
import {DestinationKind} from '../../src/renderer/src/enums/DestinationKind'
import {
  addressBookSegmentOptions,
  addressBookSendHref,
  entryExplorerUrl,
  invalidEntryAddressMessage,
  walletAddressesHref,
} from '../../src/renderer/src/utils/addressBookView'

describe('address book view helpers', () => {
  it('labels every segment with its count', () => {
    const options = addressBookSegmentOptions({
      [AddressBookSegment.All]: 7,
      [AddressBookSegment.Core]: 3,
      [AddressBookSegment.Platform]: 2,
      [AddressBookSegment.Identities]: 1,
      [AddressBookSegment.Shielded]: 0,
    })
    expect(options.map(option => option.label)).toEqual(['All · 7', 'Core · 3', 'Platform · 2', 'Identities · 1', 'Shielded · 0'])
  })

  it('links Send to the entry type and recipient', () => {
    const href = addressBookSendHref(DestinationKind.Identity, 'abc')
    const [path, query] = href.split('?')
    expect(path).toBe('/send')
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({to: DestinationKind.Identity, recipient: 'abc'})
  })

  it('links wallet addresses to a tab and an optional usage filter', () => {
    expect(walletAddressesHref(WalletAddressTab.Shielded)).toBe('/address-book/wallet?tab=shielded')
    expect(walletAddressesHref(WalletAddressTab.Platform, AddressUsage.Balance)).toBe('/address-book/wallet?tab=platform&usage=balance')
  })

  it('opens an explorer for every type except shielded addresses', () => {
    expect(entryExplorerUrl(DestinationKind.CoreAddress, 'y1', 'testnet')).toContain('y1')
    expect(entryExplorerUrl(DestinationKind.Identity, 'id1', 'testnet')).toContain('id1')
    expect(entryExplorerUrl(DestinationKind.Shielded, 'tdash1', 'testnet')).toBeNull()
  })

  it('names the active network in the invalid address message', () => {
    expect(invalidEntryAddressMessage('testnet')).toBe('Not a valid testnet address or identity ID.')
    expect(invalidEntryAddressMessage(undefined)).toBe('Not a valid address or identity ID.')
  })
})
