import {CoinSelectionParams, CoinSelectionResult, SelectableUtxo} from '../types/CoinSelection'
import {DEFAULT_SELECTION_PARAMS} from '../constants'

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

    const change = inputTotal - target - params.fee
    if (change >= 0n) {
      return { inputs: selected, inputTotal, fee: params.fee, change }
    }
  }

  throw new Error('Insufficient funds to cover amount and network fee')
}
