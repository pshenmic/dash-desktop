import { describe, it, expect } from 'vitest'
import { createBase58check } from '@scure/base'
import { sha256 } from '@noble/hashes/sha2.js'
import {
  isValidDashAddress,
  dashAddressNetwork,
  shortenAddress,
} from '../../src/renderer/src/utils/address'

const base58check = createBase58check(sha256)

const HASH20 = new Uint8Array(20).fill(7)

function makeAddress(version: number): string {
  const payload = new Uint8Array(21)
  payload[0] = version
  payload.set(HASH20, 1)
  return base58check.encode(payload)
}

const MAINNET_P2PKH = makeAddress(76)
const MAINNET_P2SH = makeAddress(16)
const TESTNET_P2PKH = makeAddress(140)
const TESTNET_P2SH = makeAddress(19)

describe('version-byte encoding sanity', () => {
  it('mainnet P2PKH addresses start with X', () => {
    expect(MAINNET_P2PKH.startsWith('X')).toBe(true)
  })

  it('testnet P2PKH addresses start with y', () => {
    expect(TESTNET_P2PKH.startsWith('y')).toBe(true)
  })
})

describe('isValidDashAddress', () => {
  it('accepts valid mainnet and testnet addresses without a network filter', () => {
    expect(isValidDashAddress(MAINNET_P2PKH)).toBe(true)
    expect(isValidDashAddress(MAINNET_P2SH)).toBe(true)
    expect(isValidDashAddress(TESTNET_P2PKH)).toBe(true)
    expect(isValidDashAddress(TESTNET_P2SH)).toBe(true)
  })

  it('enforces the requested network', () => {
    expect(isValidDashAddress(MAINNET_P2PKH, 'mainnet')).toBe(true)
    expect(isValidDashAddress(MAINNET_P2PKH, 'testnet')).toBe(false)
    expect(isValidDashAddress(TESTNET_P2PKH, 'testnet')).toBe(true)
    expect(isValidDashAddress(TESTNET_P2PKH, 'mainnet')).toBe(false)
  })

  it('rejects empty, malformed, and non-base58 input', () => {
    expect(isValidDashAddress('')).toBe(false)
    expect(isValidDashAddress('   ')).toBe(false)
    expect(isValidDashAddress('not an address')).toBe(false)
    expect(isValidDashAddress('0OIl')).toBe(false)
  })

  it('rejects an address with a corrupted checksum', () => {
    const tampered = MAINNET_P2PKH.slice(0, -1) + (MAINNET_P2PKH.endsWith('A') ? 'B' : 'A')
    expect(isValidDashAddress(tampered)).toBe(false)
  })

  it('rejects a valid base58check payload with an unknown version byte', () => {
    expect(isValidDashAddress(makeAddress(0))).toBe(false)
    expect(isValidDashAddress(makeAddress(5))).toBe(false)
  })

  it('trims surrounding whitespace', () => {
    expect(isValidDashAddress(`  ${MAINNET_P2PKH}  `)).toBe(true)
  })
})

describe('dashAddressNetwork', () => {
  it('identifies the network from the version byte', () => {
    expect(dashAddressNetwork(MAINNET_P2PKH)).toBe('mainnet')
    expect(dashAddressNetwork(MAINNET_P2SH)).toBe('mainnet')
    expect(dashAddressNetwork(TESTNET_P2PKH)).toBe('testnet')
    expect(dashAddressNetwork(TESTNET_P2SH)).toBe('testnet')
  })

  it('returns null for invalid addresses', () => {
    expect(dashAddressNetwork('nope')).toBe(null)
    expect(dashAddressNetwork(makeAddress(99))).toBe(null)
  })
})

describe('shortenAddress', () => {
  it('shortens long addresses with an ellipsis', () => {
    const result = shortenAddress(MAINNET_P2PKH)
    expect(result).toContain('…')
    expect(result.startsWith(MAINNET_P2PKH.slice(0, 8))).toBe(true)
    expect(result.endsWith(MAINNET_P2PKH.slice(-6))).toBe(true)
  })

  it('leaves short strings untouched', () => {
    expect(shortenAddress('abc')).toBe('abc')
  })
})
