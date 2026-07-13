export interface SelectableUtxo {
  txid: string
  vout: number
  satoshis: bigint
  address: string
}

export interface CoinSelectionResult {
  inputs: SelectableUtxo[]
  inputTotal: bigint
  fee: bigint
  change: bigint
}

export interface CoinSelectionParams {
  feePerByte: bigint
  signedInputSize: bigint
  changeOutputSize: bigint
  baseTxSize: bigint
  recipientOutputSize: bigint
  minFee: bigint
}

export const DEFAULT_SELECTION_PARAMS: CoinSelectionParams = {
  feePerByte: 1n,
  signedInputSize: 32n + 4n + 8n + 108n + 4n,
  changeOutputSize: 20n + 4n + 34n + 4n,
  baseTxSize: 10n,
  recipientOutputSize: 34n,
  minFee: 1000n,
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
