import { describe, it, expect } from 'vitest'
import { matchIdentityKey, IdentityKeyDescriptor, DerivedKeyHash, parseIdentityPrivateKey } from '../../src/main/src/utils/identityKeys'

function key(keyId: number, purpose: string, publicKeyHashHex: string): IdentityKeyDescriptor {
  return { keyId, purpose, publicKeyHashHex }
}

function derived(keyIndex: number, publicKeyHashHex: string): DerivedKeyHash {
  return { keyIndex, publicKeyHashHex }
}

describe('matchIdentityKey', () => {
  it('matches a transfer key by public key hash', () => {
    const result = matchIdentityKey(
      [key(0, 'AUTHENTICATION', 'aa'), key(3, 'TRANSFER', 'bb')],
      [derived(0, 'aa'), derived(3, 'bb')],
    )
    expect(result).toEqual({ keyId: 3, keyIndex: 3 })
  })

  it('ignores non-transfer keys even when their hashes are derivable', () => {
    expect(matchIdentityKey([key(0, 'AUTHENTICATION', 'aa')], [derived(0, 'aa')])).toBeNull()
  })

  it('returns null when no derived hash matches', () => {
    expect(matchIdentityKey([key(3, 'TRANSFER', 'bb')], [derived(0, 'aa')])).toBeNull()
  })

  it('prefers the lowest transfer keyId when several match', () => {
    const result = matchIdentityKey(
      [key(5, 'TRANSFER', 'cc'), key(3, 'TRANSFER', 'bb')],
      [derived(1, 'bb'), derived(2, 'cc')],
    )
    expect(result).toEqual({ keyId: 3, keyIndex: 1 })
  })

  it('matches hashes case-insensitively', () => {
    const result = matchIdentityKey([key(3, 'transfer', 'AB12')], [derived(0, 'ab12')])
    expect(result).toEqual({ keyId: 3, keyIndex: 0 })
  })
})

describe('parseIdentityPrivateKey', () => {
  it('accepts 64-character hex', () => {
    const hex = 'a1286dd195e2b8e1f6bdc946c56a53e0c544750d6452ddc0f4c593ef311f21af'
    expect(parseIdentityPrivateKey(hex, 'testnet').hex().toLowerCase()).toBe(hex)
  })

  it('accepts 0x-prefixed hex', () => {
    const hex = 'a1286dd195e2b8e1f6bdc946c56a53e0c544750d6452ddc0f4c593ef311f21af'
    expect(parseIdentityPrivateKey(`0x${hex}`, 'testnet').hex().toLowerCase()).toBe(hex)
  })

  it('accepts WIF', () => {
    const wif = 'cPGCETHtoevguQoyTSdsowCEF91yqhrcikcvBNK2CuTwpSLV7m9Z'
    expect(parseIdentityPrivateKey(wif, 'testnet').hex()).toHaveLength(64)
  })

  it('rejects malformed values', () => {
    expect(() => parseIdentityPrivateKey('not-a-private-key', 'testnet')).toThrow(/64-character hex/)
  })
})
