import { describe, expect, it } from 'vitest'
import { base58, bech32m, createBase58check } from '@scure/base'
import { sha256 } from '@noble/hashes/sha2.js'
import { addressKey, getContactKind, matchesAddressUsage } from '../../src/renderer/src/utils/addressBook'

const core = createBase58check(sha256).encode(new Uint8Array([140, ...new Uint8Array(20).fill(2)]))
const platform = bech32m.encode('tdash', bech32m.toWords(new Uint8Array(21)))
const shielded = bech32m.encode('tdash', bech32m.toWords(new Uint8Array([16, ...new Uint8Array(43)])))
const identity = base58.encode(new Uint8Array(32).fill(7))

describe('address book formats and filters', () => {
  it.each([['core', core], ['platform', platform], ['shielded', shielded], ['identity', identity]])('recognizes %s and its network', (kind, address) => {
    expect(getContactKind(address, 'testnet')).toBe(kind)
    expect(getContactKind(address, 'mainnet')).toBe(kind === 'identity' ? kind : null)
  })

  it('checks Bech32m checksums, mixed case and identity decoded size', () => {
    expect(getContactKind(shielded.slice(0, -1) + '!')).toBe(null)
    expect(getContactKind(`T${platform.slice(1)}`)).toBe(null)
    expect(getContactKind('z'.repeat(44))).toBe(null)
    expect(getContactKind(base58.encode(new Uint8Array(32)))).toBe('identity')
  })

  it('normalizes Bech32m while keeping Base58 case', () => {
    expect(addressKey(platform.toUpperCase())).toBe(platform)
    expect(addressKey(shielded.toUpperCase())).toBe(shielded)
    expect(addressKey(core)).toBe(core)
    expect(addressKey(identity)).toBe(identity)
  })

  it('retains used addresses after spending all funds and unknown balances', () => {
    expect(matchesAddressUsage('used', 0n, true)).toBe(true)
    expect(matchesAddressUsage('used', 0n, false)).toBe(false)
    expect(matchesAddressUsage('balance', null, false)).toBe(true)
    expect(matchesAddressUsage('balance', 0n, true)).toBe(false)
    expect(matchesAddressUsage('balance', 5n, true)).toBe(true)
  })
})
