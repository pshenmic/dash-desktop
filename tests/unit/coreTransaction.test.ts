import {describe, it, expect} from 'vitest'
import {utils as sdkUtils} from 'dash-core-sdk'
import {CoreTransactionService} from '../../src/main/src/services/CoreTransactionService'

// classifyRecipientAddress only touches the SDK's pure address utils, so the
// service can be built with a stub SDK for this suite.
const service = new CoreTransactionService({} as never)

const publicKeyHash = new Uint8Array(20).fill(1)
const testnetAddress = sdkUtils.publicKeyHashToAddress(publicKeyHash, 'testnet')
const mainnetAddress = sdkUtils.publicKeyHashToAddress(publicKeyHash, 'mainnet')

describe('CoreTransactionService.classifyRecipientAddress', () => {
  it('accepts a well-formed address for the matching network', () => {
    expect(() => service.classifyRecipientAddress(testnetAddress, 'testnet')).not.toThrow()
    expect(() => service.classifyRecipientAddress(mainnetAddress, 'mainnet')).not.toThrow()
  })

  it('rejects a malformed address', () => {
    expect(() => service.classifyRecipientAddress('not-an-address', 'testnet')).toThrow('Invalid recipient address')
  })

  it('rejects an address from the wrong network', () => {
    expect(() => service.classifyRecipientAddress(mainnetAddress, 'testnet')).toThrow('not a valid testnet address')
    expect(() => service.classifyRecipientAddress(testnetAddress, 'mainnet')).toThrow('not a valid mainnet address')
  })
})
