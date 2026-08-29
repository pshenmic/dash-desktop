import {CoinSelectionResult, CoreFeeForInputs, SelectableUtxo} from '../types/CoinSelection'

const bySatoshisDesc = (a: SelectableUtxo, b: SelectableUtxo): number =>
  a.satoshis < b.satoshis ? 1 : a.satoshis > b.satoshis ? -1 : 0

export function selectCoins(
  utxos: SelectableUtxo[],
  target: bigint,
  feeForInputs: CoreFeeForInputs,
): CoinSelectionResult {
  if (target <= 0n) {
    throw new Error('Send amount must be greater than zero')
  }

  const sorted = [...utxos].sort(bySatoshisDesc)

  const selected: SelectableUtxo[] = []
  let inputTotal = 0n

  for (const utxo of sorted) {
    selected.push(utxo)
    inputTotal += utxo.satoshis

    const fee = feeForInputs(selected.length)
    const change = inputTotal - target - fee
    if (change >= 0n) {
      return { inputs: selected, inputTotal, fee, change }
    }
  }

  throw new Error('Insufficient funds to cover amount and network fee')
}

// Not the balance minus a fee: an input worth less than what it adds to the fee
// leaves the set able to send less, so the answer is the best prefix.
export function maxSelectableAmount(utxos: SelectableUtxo[], feeForInputs: CoreFeeForInputs): bigint {
  const sorted = [...utxos].sort(bySatoshisDesc)

  let inputTotal = 0n
  let max = 0n

  sorted.forEach((utxo, index) => {
    inputTotal += utxo.satoshis
    const spendable = inputTotal - feeForInputs(index + 1)
    if (spendable > max) max = spendable
  })

  return max
}
