import {CoinSelectionParams, CoinSelectionResult, SelectableUtxo} from '../types/CoinSelection'
import {UTXO} from '../types/UTXO'
import {DEFAULT_SELECTION_PARAMS} from '../constants'

export function toSelectableUtxos(utxos: UTXO[]): SelectableUtxo[] {
  return utxos.map(utxo => ({
    txid: utxo.txId,
    vout: utxo.vOut,
    satoshis: utxo.satoshis,
    address: utxo.address,
  }))
}

export function resolveSelectedUtxos(selected: SelectableUtxo[], utxos: UTXO[]): UTXO[] {
  const byKey = new Map(utxos.map(utxo => [`${utxo.txId}:${utxo.vOut}`, utxo]))
  return selected.map(input => {
    const owned = byKey.get(`${input.txid}:${input.vout}`)
    if (owned == null) {
      throw new Error('Selected UTXO no longer available')
    }
    return owned
  })
}

function estimateFee(
  inputCount: number,
  withChange: boolean,
  params: CoinSelectionParams,
): bigint {
  const size =
    params.baseTxSize +
    params.signedInputSize * BigInt(inputCount) +
    params.recipientOutputSize +
    (withChange ? params.changeOutputSize : 0n)
  const fee = size * params.feePerByte
  return fee < params.minFee ? params.minFee : fee
}

export function selectCoins(
  utxos: SelectableUtxo[],
  target: bigint,
  params: CoinSelectionParams = DEFAULT_SELECTION_PARAMS,
): CoinSelectionResult {
  if (target <= 0n) {
    throw new Error('Send amount must be greater than zero')
  }

  const sorted = [...utxos].sort((a, b) => (a.satoshis < b.satoshis ? 1 : a.satoshis > b.satoshis ? -1 : 0))

  const selected: SelectableUtxo[] = []
  let inputTotal = 0n

  for (const utxo of sorted) {
    selected.push(utxo)
    inputTotal += utxo.satoshis

    // Enough to add a change output worth keeping: charge the with-change fee
    // and return the remainder as change.
    const feeWithChange = estimateFee(selected.length, true, params)
    const change = inputTotal - target - feeWithChange
    if (change >= params.minFee) {
      return { inputs: selected, inputTotal, fee: feeWithChange, change }
    }

    // Not enough for a worthwhile change output, but enough to cover the amount
    // and the (smaller) no-change fee — drop the dust remainder into the fee.
    const feeNoChange = estimateFee(selected.length, false, params)
    if (inputTotal >= target + feeNoChange) {
      return { inputs: selected, inputTotal, fee: inputTotal - target, change: 0n }
    }
  }

  throw new Error('Insufficient funds to cover amount and network fee')
}
