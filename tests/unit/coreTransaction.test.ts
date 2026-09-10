import {describe, it, expect} from 'vitest'
import {Output, Script, TransactionType, utils as sdkUtils} from 'dash-core-sdk'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {TransferInput} from '../../src/main/src/types/CoreTransaction'
import {ADDRESS_PREFIX} from '../../src/main/src/constants/addresses'
const service = new CoreTransactionService()

const publicKeyHash = new Uint8Array(20).fill(1)
const testnetAddress = sdkUtils.publicKeyHashToAddress(publicKeyHash, 'testnet')
const mainnetAddress = sdkUtils.publicKeyHashToAddress(publicKeyHash, 'mainnet')

describe('CoreTransactionService.classifyAddress', () => {
  it('accepts a well-formed address for the matching network', () => {
    expect(() => service.classifyAddress(testnetAddress, 'testnet')).not.toThrow()
    expect(() => service.classifyAddress(mainnetAddress, 'mainnet')).not.toThrow()
  })

  it('rejects a malformed address', () => {
    expect(() => service.classifyAddress('not-an-address', 'testnet')).toThrow('Invalid address')
  })

  it('rejects an address from the wrong network', () => {
    expect(() => service.classifyAddress(mainnetAddress, 'testnet')).toThrow('not a valid testnet address')
    expect(() => service.classifyAddress(testnetAddress, 'mainnet')).toThrow('not a valid mainnet address')
  })
})

describe('CoreTransactionService.requireChangeAddress', () => {
  const testnetP2SH = Base58Check.encode(new Uint8Array([ADDRESS_PREFIX.testnet.p2sh, ...publicKeyHash]))

  it('accepts a P2PKH address on the send network', () => {
    expect(() => service.requireChangeAddress(testnetAddress, 'testnet')).not.toThrow()
  })

  // addChange builds a P2PKH output, which would pay the script hash as if it
  // were a pubkey hash.
  it('refuses a P2SH address', () => {
    expect(() => service.requireChangeAddress(testnetP2SH, 'testnet')).toThrow('must be a P2PKH address')
  })

  it('refuses an address the send network cannot pay', () => {
    expect(() => service.requireChangeAddress(mainnetAddress, 'testnet')).toThrow('not a valid testnet address')
    expect(() => service.requireChangeAddress('not-an-address', 'testnet')).toThrow('Invalid address')
  })
})

describe('CoreTransactionService.buildSignedAssetLock', () => {
  const SEED = new KeyPairController().mnemonicToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')
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

  const FEE = 10_000n

  it('builds an asset-lock tx with OP_RETURN lock output, change, and credit payload', async () => {
    const lockAmount = 100_000n
    const inputTotal = 200_000n

    const tx = await service.buildSignedAssetLock({
      inputs: [input],
      amountDuffs: lockAmount,
      creditAddress: CREDIT_ADDRESS,
      changeAddress: CHANGE_ADDRESS,
      inputTotal,
      feeDuffs: FEE,
      seed: SEED,
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

  // The fee is the gap the transaction leaves; any other gap was never quoted.
  it('leaves exactly the quoted fee between its inputs and its outputs', async () => {
    const lockAmount = 100_000n
    const inputTotal = 200_000n

    const tx = await service.buildSignedAssetLock({
      inputs: [input],
      amountDuffs: lockAmount,
      creditAddress: CREDIT_ADDRESS,
      changeAddress: CHANGE_ADDRESS,
      inputTotal,
      feeDuffs: FEE,
      seed: SEED,
      network: 'testnet',
    })

    const outputTotal = tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n)
    expect(inputTotal - outputTotal).toBe(FEE)
  })

  // generateChange used to invent a change output worth more than the inputs.
  it('emits no change output when the send consumes the whole balance', async () => {
    const inputTotal = 200_000n
    const lockAmount = inputTotal - FEE

    const tx = await service.buildSignedAssetLock({
      inputs: [input],
      amountDuffs: lockAmount,
      creditAddress: CREDIT_ADDRESS,
      changeAddress: CHANGE_ADDRESS,
      inputTotal,
      feeDuffs: FEE,
      seed: SEED,
      network: 'testnet',
    })

    expect(tx.outputs).toHaveLength(1)
    const outputTotal = tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n)
    expect(outputTotal).toBeLessThanOrEqual(inputTotal)
    expect(inputTotal - outputTotal).toBe(FEE)
  })

  // Core rejects an output below the dust threshold outright.
  it('gives change below the dust threshold to the fee instead of an output', async () => {
    const inputTotal = 200_000n
    const lockAmount = inputTotal - FEE - 500n

    const tx = await service.buildSignedAssetLock({
      inputs: [input],
      amountDuffs: lockAmount,
      creditAddress: CREDIT_ADDRESS,
      changeAddress: CHANGE_ADDRESS,
      inputTotal,
      feeDuffs: FEE,
      seed: SEED,
      network: 'testnet',
    })

    expect(tx.outputs).toHaveLength(1)
    expect(inputTotal - tx.outputs[0].satoshis).toBe(FEE + 500n)
  })

  it('refuses inputs that cannot cover the amount and the fee', async () => {
    await expect(service.buildSignedAssetLock({
      inputs: [input],
      amountDuffs: 200_000n,
      creditAddress: CREDIT_ADDRESS,
      changeAddress: CHANGE_ADDRESS,
      inputTotal: 200_000n,
      feeDuffs: FEE,
      seed: SEED,
      network: 'testnet',
    })).rejects.toThrow('do not cover')
  })
})
