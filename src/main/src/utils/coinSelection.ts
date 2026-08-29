import {CoinSelectionResult, CoreFeeForInputs, CoreSpendSource, SelectableUtxo} from '../types/CoinSelection'

const bySatoshisDesc = (a: SelectableUtxo, b: SelectableUtxo): number =>
  a.satoshis < b.satoshis ? 1 : a.satoshis > b.satoshis ? -1 : 0

const totalOf = (utxos: SelectableUtxo[]): bigint =>
  utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0n)

export function selectCoins(
  utxos: SelectableUtxo[],
  target: bigint,
  feeForInputs: CoreFeeForInputs,
  source?: CoreSpendSource,
): CoinSelectionResult {
  if (target <= 0n) {
    throw new Error('Send amount must be greater than zero')
  }

  // A picked set is spent whole rather than walked: stopping early would drop
  // coins the user asked to spend, which is the one thing picking them means.
  if (source?.kind === 'outpoints') {
    if (utxos.length === 0) {
      throw new Error('Insufficient funds to cover amount and network fee')
    }

    const inputTotal = totalOf(utxos)
    const fee = feeForInputs(utxos.length)
    const change = inputTotal - target - fee

    if (change < 0n) {
      throw new Error('Insufficient funds to cover amount and network fee')
    }

    return {inputs: [...utxos], inputTotal, fee, change}
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
export function maxSelectableAmount(
  utxos: SelectableUtxo[],
  feeForInputs: CoreFeeForInputs,
  source?: CoreSpendSource,
): bigint {
  // No prefix to choose from when every coin is spent: the price is the one the
  // picked count carries, whether or not a smaller set would have been cheaper.
  if (source?.kind === 'outpoints') {
    if (utxos.length === 0) return 0n
    const spendable = totalOf(utxos) - feeForInputs(utxos.length)
    return spendable > 0n ? spendable : 0n
  }

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
