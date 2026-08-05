import {describe, it, expect} from 'vitest'
import {Output, Script, Transaction as SDKTransaction, utils as sdkUtils} from 'dash-core-sdk'
import {CHANGE_OUTPUT_MAX_SIZE, MIN_FEE_RELAY, SIGNED_INPUT_MAX_SIZE} from 'dash-core-sdk/src/constants.js'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {assertRelayFee, estimateCoreFee, outputsTotal} from '../../src/main/src/utils/coreFeeEstimate'
import {buildTransferTx} from '../../src/main/src/utils/coreTxBuild'
import {resolveSelectedUtxos, selectCoins, toSelectableUtxos} from '../../src/main/src/utils/coinSelection'
import {CoreFeeShape} from '../../src/main/src/enums/CoreFeeShape'
import {CoreFeeQuery, CoreFeeRecipient} from '../../src/main/src/types/CoreFee'
import {DraftInput} from '../../src/main/src/types/CoreTransaction'
import {UTXO} from '../../src/main/src/types/UTXO'

const ONE_DASH = 100_000_000n

const P2PKH_ADDRESS = sdkUtils.publicKeyHashToAddress(new Uint8Array(20).fill(7), 'testnet')
const P2SH_ADDRESS = Base58Check.encode(new Uint8Array([19, ...new Uint8Array(20).fill(7)]))
const CHANGE_ADDRESS = sdkUtils.publicKeyHashToAddress(new Uint8Array(20).fill(9), 'testnet')
const CREDIT_ADDRESS = sdkUtils.publicKeyHashToAddress(new Uint8Array(20).fill(11), 'testnet')

const P2PKH_RECIPIENT: CoreFeeRecipient = {address: P2PKH_ADDRESS, type: 'p2pkh'}
const P2SH_RECIPIENT: CoreFeeRecipient = {address: P2SH_ADDRESS, type: 'p2sh'}

const TRANSFER_BASE = (() => {
  const tx = new SDKTransaction()
  const recipientOutput = new Output(1n)
  recipientOutput.generateP2PKH(P2PKH_ADDRESS)
  tx.addOutput(recipientOutput)
  return BigInt(tx.bytes().byteLength)
})()

function transferFee(inputCount: number): bigint {
  return TRANSFER_BASE + BigInt(inputCount) * BigInt(SIGNED_INPUT_MAX_SIZE) + BigInt(CHANGE_OUTPUT_MAX_SIZE)
}

function utxo(satoshis: bigint, n = 1): UTXO {
  return {
    address: `addr${n}`,
    satoshis,
    script: Script.fromHex('76a914' + '11'.repeat(20) + '88ac'),
    txId: n.toString(16).padStart(2, '0').repeat(32),
    vOut: 0,
  }
}

function draftInputs(utxos: UTXO[]): DraftInput[] {
  return utxos.map(u => ({txId: u.txId, vOut: u.vOut, script: u.script}))
}

function sendQuery(amountDuffs: bigint): CoreFeeQuery {
  return {shape: CoreFeeShape.Send, amountDuffs, toAddress: null, fromAddress: null}
}

describe('estimateCoreFee', () => {
  it('prices a p2pkh send with change at exactly size times the fee rate', () => {
    const utxos = [utxo(ONE_DASH, 1), utxo(ONE_DASH, 2)]
    const quote = estimateCoreFee(utxos, sendQuery(ONE_DASH / 2n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)

    expect(quote.feeDuffs).toBe(transferFee(1))

    const draft = buildTransferTx({
      inputs: draftInputs([utxos[0]]),
      toAddress: P2PKH_ADDRESS,
      recipientType: 'p2pkh',
      amountDuffs: ONE_DASH / 2n,
      changeAddress: CHANGE_ADDRESS,
      inputTotal: ONE_DASH,
    })
    expect(ONE_DASH - outputsTotal(draft)).toBe(quote.feeDuffs)
  })

  it('prices a p2sh recipient two duffs below the p2pkh one', () => {
    const utxos = [utxo(ONE_DASH, 1)]
    const p2pkh = estimateCoreFee(utxos, sendQuery(ONE_DASH / 2n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)
    const p2sh = estimateCoreFee(utxos, sendQuery(ONE_DASH / 2n), P2SH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)

    expect(p2sh.feeDuffs).toBe(p2pkh.feeDuffs! - 2n)
  })

  it('prices an asset lock above a plain send on the same inputs', () => {
    const utxos = [utxo(ONE_DASH, 1), utxo(ONE_DASH, 2)]
    const send = estimateCoreFee(utxos, sendQuery(ONE_DASH / 2n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)
    const lock = estimateCoreFee(utxos, {shape: CoreFeeShape.AssetLock, amountDuffs: ONE_DASH / 2n}, P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)

    expect(lock.feeDuffs).not.toBeNull()
    expect(lock.feeDuffs!).toBeGreaterThan(send.feeDuffs!)
  })

  it('leaves exactly the relay floor as change when sending the maximum', () => {
    const utxos = [utxo(ONE_DASH, 1), utxo(ONE_DASH, 2)]
    const total = 2n * ONE_DASH
    const {maxSendableDuffs} = estimateCoreFee(utxos, sendQuery(0n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)

    expect(maxSendableDuffs).toBeGreaterThan(0n)

    const atMax = estimateCoreFee(utxos, sendQuery(maxSendableDuffs), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)
    expect(atMax.feeDuffs).toBe(transferFee(2))
    expect(total - maxSendableDuffs - atMax.feeDuffs!).toBe(BigInt(MIN_FEE_RELAY))

    const draft = buildTransferTx({
      inputs: draftInputs(utxos),
      toAddress: P2PKH_ADDRESS,
      recipientType: 'p2pkh',
      amountDuffs: maxSendableDuffs,
      changeAddress: CHANGE_ADDRESS,
      inputTotal: total,
    })
    expect(() => assertRelayFee(draft, total)).not.toThrow()
  })

  it('reports a zero maximum for empty and micro wallets', () => {
    expect(estimateCoreFee([], sendQuery(0n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS))
      .toEqual({feeDuffs: null, maxSendableDuffs: 0n})
    expect(estimateCoreFee([utxo(500n)], sendQuery(0n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS).maxSendableDuffs).toBe(0n)
    expect(estimateCoreFee([utxo(650n)], sendQuery(0n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS).maxSendableDuffs).toBe(0n)
  })

  it('answers a zero-amount query with the maximum only', () => {
    const quote = estimateCoreFee([utxo(ONE_DASH, 1)], sendQuery(0n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)

    expect(quote.feeDuffs).toBeNull()
    expect(quote.maxSendableDuffs).toBeGreaterThan(0n)
  })

  it('gives no fee above the maximum or beyond the balance', () => {
    const utxos = [utxo(ONE_DASH, 1)]
    const {maxSendableDuffs} = estimateCoreFee(utxos, sendQuery(0n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)

    const above = estimateCoreFee(utxos, sendQuery(maxSendableDuffs + 1n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)
    expect(above.feeDuffs).toBeNull()
    expect(above.maxSendableDuffs).toBe(maxSendableDuffs)
  })
})

describe('assertRelayFee', () => {
  it('refuses amounts inside the broken change zone above the maximum', () => {
    const utxos = [utxo(ONE_DASH, 1)]
    const {maxSendableDuffs} = estimateCoreFee(utxos, sendQuery(0n), P2PKH_RECIPIENT, CHANGE_ADDRESS, CREDIT_ADDRESS)

    for (const delta of [BigInt(MIN_FEE_RELAY) / 2n, BigInt(CHANGE_OUTPUT_MAX_SIZE) + BigInt(MIN_FEE_RELAY) - 1n]) {
      const draft = buildTransferTx({
        inputs: draftInputs(utxos),
        toAddress: P2PKH_ADDRESS,
        recipientType: 'p2pkh',
        amountDuffs: maxSendableDuffs + delta,
        changeAddress: CHANGE_ADDRESS,
        inputTotal: ONE_DASH,
      })
      expect(() => assertRelayFee(draft, ONE_DASH)).toThrow('fee below relay minimum')
    }
  })
})

describe('selectCoins reserve vs dry-run truth', () => {
  it('reserves at least the fee the dry run actually pays', () => {
    const scenarios: Array<{utxos: UTXO[]; target: bigint}> = [
      {utxos: [utxo(ONE_DASH, 1)], target: ONE_DASH / 2n},
      {utxos: [utxo(30_000n, 1), utxo(30_000n, 2), utxo(30_000n, 3)], target: 50_000n},
      {utxos: [utxo(ONE_DASH, 1), utxo(2_000n, 2)], target: ONE_DASH - 500n},
      {utxos: [utxo(5n * ONE_DASH, 1)], target: 3n * ONE_DASH},
      {utxos: [utxo(ONE_DASH, 1)], target: ONE_DASH - transferFee(1) - BigInt(MIN_FEE_RELAY)},
    ]

    for (const {utxos, target} of scenarios) {
      const selection = selectCoins(toSelectableUtxos(utxos), target)
      const draft = buildTransferTx({
        inputs: draftInputs(resolveSelectedUtxos(selection.inputs, utxos)),
        toAddress: P2PKH_ADDRESS,
        recipientType: 'p2pkh',
        amountDuffs: target,
        changeAddress: CHANGE_ADDRESS,
        inputTotal: selection.inputTotal,
      })
      expect(selection.fee).toBeGreaterThanOrEqual(selection.inputTotal - outputsTotal(draft))
    }
  })
})
