import { describe, it, expect } from 'vitest'
import { utils as sdkUtils } from 'dash-core-sdk'
import { Base58Check } from 'dash-core-sdk/src/base58check.js'
import { coreAddressToScript } from '../../src/main/src/services/coreScript'

const keyHash = new Uint8Array(20).fill(7)
const keyHashHex = '07'.repeat(20)
const testnetP2PKH = sdkUtils.publicKeyHashToAddress(keyHash, 'testnet')
const mainnetP2PKH = sdkUtils.publicKeyHashToAddress(keyHash, 'mainnet')
const testnetP2SH = Base58Check.encode(new Uint8Array([19, ...keyHash]))
const mainnetP2SH = Base58Check.encode(new Uint8Array([16, ...keyHash]))

describe('coreAddressToScript', () => {
  it('builds a p2pkh script from a p2pkh address', () => {
    expect(coreAddressToScript(testnetP2PKH, 'testnet').hex()).toBe(`76a914${keyHashHex}88ac`)
    expect(coreAddressToScript(mainnetP2PKH, 'mainnet').hex()).toBe(`76a914${keyHashHex}88ac`)
  })

  it('builds a p2sh script from a p2sh address', () => {
    expect(coreAddressToScript(testnetP2SH, 'testnet').hex()).toBe(`a914${keyHashHex}87`)
    expect(coreAddressToScript(mainnetP2SH, 'mainnet').hex()).toBe(`a914${keyHashHex}87`)
  })

  it('round-trips the address through the script', () => {
    expect(coreAddressToScript(testnetP2PKH, 'testnet').toAddress('testnet')).toBe(testnetP2PKH)
  })

  it('rejects a malformed address', () => {
    expect(() => coreAddressToScript('not-an-address', 'testnet')).toThrow('Invalid Core address')
  })

  it('rejects an address from the wrong network', () => {
    expect(() => coreAddressToScript(mainnetP2PKH, 'testnet')).toThrow('not a valid testnet address')
    expect(() => coreAddressToScript(testnetP2SH, 'mainnet')).toThrow('not a valid mainnet address')
  })
})
