import {bech32m, createBase58check} from '@scure/base'
import {sha256} from '@noble/hashes/sha2.js'
import {describe, expect, it} from 'vitest'
import {DestinationKind} from '../../src/renderer/src/enums/DestinationKind'
import {isValidDestinationAddress} from '../../src/renderer/src/utils/destinationAddress'

const testnetCore = createBase58check(sha256).encode(Uint8Array.from([140, ...Array(20).fill(1)]))
const mainnetCore = createBase58check(sha256).encode(Uint8Array.from([76, ...Array(20).fill(1)]))
const testnetPlatform = bech32m.encode('tdash', bech32m.toWords(Uint8Array.from([0xb0, ...Array(20).fill(1)])))
const identityId = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'
const shielded = `tdash1${'q'.repeat(70)}`

describe('isValidDestinationAddress', () => {
  it('validates Core addresses for the active network', () => {
    expect(isValidDestinationAddress(DestinationKind.CoreAddress, ` ${testnetCore} `, 'testnet')).toBe(true)
    expect(isValidDestinationAddress(DestinationKind.CoreAddress, mainnetCore, 'testnet')).toBe(false)
    expect(isValidDestinationAddress(DestinationKind.CoreAddress, testnetPlatform, 'testnet')).toBe(false)
  })

  it('validates Platform addresses for the active network', () => {
    expect(isValidDestinationAddress(DestinationKind.PlatformAddress, testnetPlatform, 'testnet')).toBe(true)
    expect(isValidDestinationAddress(DestinationKind.PlatformAddress, testnetPlatform, 'mainnet')).toBe(false)
    expect(isValidDestinationAddress(DestinationKind.PlatformAddress, testnetCore, 'testnet')).toBe(false)
  })

  it('accepts identity identifiers and shielded addresses by shape', () => {
    expect(isValidDestinationAddress(DestinationKind.Identity, identityId, null)).toBe(true)
    expect(isValidDestinationAddress(DestinationKind.Identity, testnetCore, null)).toBe(false)
    expect(isValidDestinationAddress(DestinationKind.Shielded, shielded, null)).toBe(true)
    expect(isValidDestinationAddress(DestinationKind.Shielded, identityId, null)).toBe(false)
  })

  it('never accepts a typed value for a new identity', () => {
    expect(isValidDestinationAddress(DestinationKind.NewIdentity, identityId, 'testnet')).toBe(false)
  })
})
