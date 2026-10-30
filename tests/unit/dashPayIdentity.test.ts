import { describe, expect, it } from 'vitest'
import { dashPayHref, filterIdentities, incomingCountByIdentity, resolveActiveIdentity } from '../../src/renderer/src/utils/dashPayIdentity'
import { ActiveIdentitySource, DashPayContactRelationship } from '../../src/renderer/src/enums/DashPay'
import type { DashPayContactDto, IdentityKeyDto } from '../../src/renderer/src/api/types'
import type { IdentityApiDto } from '../../src/renderer/src/hooks/useIdentities'

function key(keyId: number, purpose: string, securityLevel: string): IdentityKeyDto {
  return { keyId, purpose, securityLevel, keyType: 'ECDSA_SECP256K1', data: '', readOnly: false, disabledAt: null, contractBounds: null }
}

const DASHPAY_KEYS = [key(0, 'AUTHENTICATION', 'MASTER'), key(1, 'AUTHENTICATION', 'HIGH'), key(2, 'ENCRYPTION', 'MEDIUM'), key(3, 'DECRYPTION', 'MEDIUM')]
const LEGACY_KEYS = [key(0, 'AUTHENTICATION', 'MASTER'), key(1, 'AUTHENTICATION', 'HIGH')]

function identity(identifier: string, identityIndex: number, usernames: string[], keys: IdentityKeyDto[]): IdentityApiDto {
  return {
    identityIndex,
    identifier,
    usernames,
    keys,
    balance: { amount: 1n, usdAmount: '0.0' },
    derivationPath: '',
    assetLockTxid: null,
  }
}

const bare = identity('BareIdentity', 0, [], LEGACY_KEYS)
const keyed = identity('KeyedIdentity', 1, [], DASHPAY_KEYS)
const named = identity('NamedIdentity', 2, ['carol.dash'], LEGACY_KEYS)
const ready = identity('ReadyIdentity', 3, ['alice.dash'], DASHPAY_KEYS)

describe('resolveActiveIdentity', () => {
  it('prefers the requested identity when it belongs to the wallet', () => {
    expect(resolveActiveIdentity({ identities: [bare, ready], requested: 'BareIdentity', stored: 'ReadyIdentity' }))
      .toEqual({ identity: bare, source: ActiveIdentitySource.Requested })
  })

  it('falls back to the stored identity when the request is foreign', () => {
    expect(resolveActiveIdentity({ identities: [bare, ready], requested: 'OtherWallet', stored: 'BareIdentity' }))
      .toEqual({ identity: bare, source: ActiveIdentitySource.Stored })
  })

  it('picks Ready, then a username, then DashPay keys, then the first identity', () => {
    const resolve = (identities: IdentityApiDto[]) => resolveActiveIdentity({ identities, requested: null, stored: 'Gone' })
    expect(resolve([bare, keyed, named, ready])).toEqual({ identity: ready, source: ActiveIdentitySource.Fallback })
    expect(resolve([bare, keyed, named])).toEqual({ identity: named, source: ActiveIdentitySource.Fallback })
    expect(resolve([bare, keyed])).toEqual({ identity: keyed, source: ActiveIdentitySource.Fallback })
    expect(resolve([bare])).toEqual({ identity: bare, source: ActiveIdentitySource.Fallback })
  })

  it('walks identities in identityIndex order regardless of input order', () => {
    const second = identity('SecondReady', 5, ['bob.dash'], DASHPAY_KEYS)
    expect(resolveActiveIdentity({ identities: [second, ready], requested: null, stored: null }).identity).toBe(ready)
  })

  it('resolves to none for a wallet without identities', () => {
    expect(resolveActiveIdentity({ identities: [], requested: 'x', stored: 'y' }))
      .toEqual({ identity: null, source: ActiveIdentitySource.None })
  })
})

describe('filterIdentities', () => {
  const identities = [identity('B7kcEqgCRh', 0, ['a1ice.dash', 'bob-pay.dash'], DASHPAY_KEYS), identity('7cBLvTFh9n', 1, [], DASHPAY_KEYS)]

  it('matches any name homograph-insensitively', () => {
    expect(filterIdentities(identities, 'ALICE').map(entry => entry.identifier)).toEqual(['B7kcEqgCRh'])
    expect(filterIdentities(identities, 'pay').map(entry => entry.identifier)).toEqual(['B7kcEqgCRh'])
  })

  it('matches an identifier substring case-sensitively', () => {
    expect(filterIdentities(identities, 'BLv').map(entry => entry.identifier)).toEqual(['7cBLvTFh9n'])
    expect(filterIdentities(identities, 'blv')).toEqual([])
  })

  it('keeps every identity for a blank query', () => {
    expect(filterIdentities(identities, ' ')).toEqual(identities)
  })
})

describe('incomingCountByIdentity', () => {
  it('counts incoming requests per identity of the wallet', () => {
    const contact = (identifier: string, relationship: DashPayContactRelationship): DashPayContactDto => ({
      identifier,
      contactId: `${identifier}-${relationship}`,
      relationship,
      usernames: [],
      incomingCreatedAt: null,
      outgoingCreatedAt: null,
      paymentChannelBroken: false,
    })
    expect(incomingCountByIdentity([
      contact('a', DashPayContactRelationship.Incoming),
      { ...contact('a', DashPayContactRelationship.Incoming), contactId: 'second' },
      contact('a', DashPayContactRelationship.Established),
      contact('b', DashPayContactRelationship.Outgoing),
      contact('c', DashPayContactRelationship.Incoming),
    ])).toEqual({ a: 2, c: 1 })
  })
})

describe('dashPayHref', () => {
  it('puts the acting identity first, then the extra params', () => {
    expect(dashPayHref('/dashpay/contacts/new', 'Ident1')).toBe('/dashpay/contacts/new?identity=Ident1')
    expect(dashPayHref('/dashpay', 'Ident1', { tab: 'contacts', contact: 'Peer2' })).toBe('/dashpay?identity=Ident1&tab=contacts&contact=Peer2')
  })

  it('leaves out a null identity or param', () => {
    expect(dashPayHref('/dashpay', null, { tab: 'keys' })).toBe('/dashpay?tab=keys')
    expect(dashPayHref('/dashpay/usernames/new', 'Ident1', { label: null })).toBe('/dashpay/usernames/new?identity=Ident1')
  })
})
