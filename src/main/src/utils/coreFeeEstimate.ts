import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {FEE_PER_BYTE, MIN_FEE_RELAY} from 'dash-core-sdk/src/constants.js'
import {CORE_FEE_PROBE_AMOUNT_DUFFS} from '../constants'
import {CoreFeeShape} from '../enums/CoreFeeShape'
import {CoreFeeQuery, CoreFeeQuote, CoreFeeRecipient} from '../types/CoreFee'
import {DraftInput} from '../types/CoreTransaction'
import {UTXO} from '../types/UTXO'
import {selectCoins} from './coinSelection'
import {buildAssetLockTx, buildTransferTx} from './coreTxBuild'

function outputsTotal(tx: SDKTransaction): bigint {
  return tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n)
}

function dryRun(
  shape: CoreFeeShape,
  inputs: DraftInput[],
  amountDuffs: bigint,
  recipient: CoreFeeRecipient,
  changeAddress: string,
  creditAddress: string,
  inputTotal: bigint,
): SDKTransaction {
  if (shape === CoreFeeShape.AssetLock) {
    return buildAssetLockTx({inputs, amountDuffs, creditAddress, changeAddress, inputTotal})
  }
  return buildTransferTx({
    inputs,
    toAddress: recipient.address,
    recipientType: recipient.type,
    amountDuffs,
    changeAddress,
    inputTotal,
  })
}

export function estimateCoreFee(
  utxos: UTXO[],
  query: CoreFeeQuery,
  recipient: CoreFeeRecipient,
  changeAddress: string,
  creditAddress: string,
): CoreFeeQuote {
  if (utxos.length === 0) {
    return {feeDuffs: null, maxSendableDuffs: 0n}
  }

  const inputTotalAll = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0n)
  const draftInputsAll: DraftInput[] = utxos.map(utxo => ({txId: utxo.txId, vOut: utxo.vOut, script: utxo.script}))

  let maxSendableDuffs = 0n
  try {
    const probe = dryRun(query.shape, draftInputsAll, CORE_FEE_PROBE_AMOUNT_DUFFS, recipient, changeAddress, creditAddress, inputTotalAll)
    if (probe.outputs.length > 1) {
      const feeAll = inputTotalAll - outputsTotal(probe)
      const max = inputTotalAll - feeAll - BigInt(MIN_FEE_RELAY)
      maxSendableDuffs = max > 0n ? max : 0n
    }
  } catch {
    return {feeDuffs: null, maxSendableDuffs: 0n}
  }

  if (query.amountDuffs <= 0n || query.amountDuffs > maxSendableDuffs) {
    return {feeDuffs: null, maxSendableDuffs}
  }

  try {
    const selection = selectCoins(
      utxos.map(utxo => ({txid: utxo.txId, vout: utxo.vOut, satoshis: utxo.satoshis, address: utxo.address})),
      query.amountDuffs,
    )
    const utxoByKey = new Map(utxos.map(utxo => [`${utxo.txId}:${utxo.vOut}`, utxo]))
    const draftInputs: DraftInput[] = selection.inputs.map(input => {
      const owned = utxoByKey.get(`${input.txid}:${input.vout}`)
      if (owned == null) {
        throw new Error('Selected UTXO no longer available')
      }
      return {txId: owned.txId, vOut: owned.vOut, script: owned.script}
    })
    const tx = dryRun(query.shape, draftInputs, query.amountDuffs, recipient, changeAddress, creditAddress, selection.inputTotal)
    const feeDuffs = selection.inputTotal - outputsTotal(tx)
    return {feeDuffs: feeDuffs > 0n ? feeDuffs : null, maxSendableDuffs}
  } catch {
    return {feeDuffs: null, maxSendableDuffs}
  }
}

export function assertRelayFee(tx: SDKTransaction, inputTotal: bigint): void {
  if (inputTotal - outputsTotal(tx) < BigInt(tx.bytes().byteLength) * BigInt(FEE_PER_BYTE)) {
    throw new Error('Refusing to broadcast: fee below relay minimum — lower the amount')
  }
}
