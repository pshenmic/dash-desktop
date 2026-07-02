import { describe, it, expect } from 'vitest'
import { coreAddressToPlatformAddress } from '../../src/main/src/services/platformAddress'

const CORE_TESTNET_ADDRESS = 'yZZkv2xhfqoXMgWEDvog9U65c17RzZLrbV'

describe('coreAddressToPlatformAddress', () => {
  it('encodes a Core base58 address to its testnet platform bech32m form', () => {
    expect(coreAddressToPlatformAddress(CORE_TESTNET_ADDRESS, 'testnet')).toBe(
      'tdash1kzg5azscav69z7m6dfzr9ner0a5vt7pn9ca4sz8d'
    )
  })

  it('encodes the same key hash to its mainnet platform bech32m form', () => {
    expect(coreAddressToPlatformAddress(CORE_TESTNET_ADDRESS, 'mainnet')).toBe(
      'dash1kzg5azscav69z7m6dfzr9ner0a5vt7pn9cdjrukr'
    )
  })

  it('throws on a malformed address', () => {
    expect(() => coreAddressToPlatformAddress('not-an-address', 'testnet')).toThrow()
  })
})
