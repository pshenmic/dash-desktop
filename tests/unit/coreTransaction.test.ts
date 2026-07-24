import {describe, it, expect} from 'vitest'
import {Output, Script, TransactionType, utils as sdkUtils} from 'dash-core-sdk'
import {CoreTransactionService, TransferInput} from '../../src/main/src/services/CoreTransactionService'
import {SdkProvider} from '../../src/main/src/providers/SdkProvider'

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

describe('CoreTransactionService.buildSignedAssetLock', () => {
  const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  // Valid testnet P2PKH base58 vectors (version byte 140).
  const CREDIT_ADDRESS = 'yLQkj9a5TNjotA96dLkkEuc67JzLvi9DbJ'
  const CHANGE_ADDRESS = 'yLW4c6QpWVbxGdm4pwssbG736zudM2Mxrw'

  const input: TransferInput = {
    txId: 'aa'.repeat(32),
    vOut: 0,
    script: Script.fromHex('76a914' + '11'.repeat(20) + '88ac'),
    derivationPath: "m/44'/1'/0'/0/0",
    address: CHANGE_ADDRESS,
  }

  it('builds an asset-lock tx with OP_RETURN lock output, change, and credit payload', async () => {
    const lockAmount = 100_000n
    const inputTotal = 200_000n

    const tx = await new CoreTransactionService(new SdkProvider()).buildSignedAssetLock({
      inputs: [input],
      amountDuffs: lockAmount,
      creditAddress: CREDIT_ADDRESS,
      changeAddress: CHANGE_ADDRESS,
      inputTotal,
      mnemonic: MNEMONIC,
      network: 'testnet',
    })

    expect(tx.type).toBe(TransactionType.TRANSACTION_ASSET_LOCK)

    expect(tx.outputs[0].satoshis).toBe(lockAmount)
    expect(tx.outputs[0].getAddress('testnet')).toBeUndefined()

    expect(tx.outputs).toHaveLength(2)
    expect(tx.outputs[1].getAddress('testnet')).toBe(CHANGE_ADDRESS)

    const payload = tx.extraPayload as unknown as {outputs: Output[]}
    expect(payload.outputs).toHaveLength(1)
    expect(payload.outputs[0].satoshis).toBe(lockAmount)
    expect(payload.outputs[0].getAddress('testnet')).toBe(CREDIT_ADDRESS)

    expect(tx.inputs).toHaveLength(1)
    expect(typeof tx.hex()).toBe('string')
    expect(tx.hex().length).toBeGreaterThan(0)
  })
})
