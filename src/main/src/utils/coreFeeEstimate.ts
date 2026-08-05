import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {FEE_PER_BYTE, MIN_FEE_RELAY} from 'dash-core-sdk/src/constants.js'
import {CORE_FEE_PROBE_AMOUNT_DUFFS} from '../constants'
import {CoreFeeShape} from '../enums/CoreFeeShape'
import {CoreFeeQuery, CoreFeeQuote, CoreFeeRecipient} from '../types/CoreFee'
import {DraftInput} from '../types/CoreTransaction'
import {UTXO} from '../types/UTXO'
import {resolveSelectedUtxos, selectCoins, toSelectableUtxos} from './coinSelection'
import {buildAssetLockTx, buildTransferTx} from './coreTxBuild'

export function outputsTotal(tx: SDKTransaction): bigint {
  return tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n)
}

function toDraftInputs(utxos: UTXO[]): DraftInput[] {
  return utxos.map(utxo => ({txId: utxo.txId, vOut: utxo.vOut, script: utxo.script}))
}

export function estimateCoreFee(
  utxos: UTXO[],
  query: CoreFeeQuery,
  recipient: CoreFeeRecipient | null,
  changeAddress: string,
  creditAddress: string,
): CoreFeeQuote {
  if (utxos.length === 0) {
    return {feeDuffs: null, maxSendableDuffs: 0n}
  }

  const target: CoreFeeRecipient = recipient ?? {address: changeAddress, type: 'p2pkh'}
  const dryRun = (inputs: DraftInput[], amountDuffs: bigint, inputTotal: bigint): SDKTransaction =>
    query.shape === CoreFeeShape.AssetLock
      ? buildAssetLockTx({inputs, amountDuffs, creditAddress, changeAddress, inputTotal})
      : buildTransferTx({
          inputs,
          toAddress: target.address,
          recipientType: target.type,
          amountDuffs,
          changeAddress,
          inputTotal,
        })

  const inputTotalAll = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0n)

  let maxSendableDuffs = 0n
  try {
    const probe = dryRun(toDraftInputs(utxos), CORE_FEE_PROBE_AMOUNT_DUFFS, inputTotalAll)
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
    const selection = selectCoins(toSelectableUtxos(utxos), query.amountDuffs)
    const inputs = toDraftInputs(resolveSelectedUtxos(selection.inputs, utxos))
    const tx = dryRun(inputs, query.amountDuffs, selection.inputTotal)
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
