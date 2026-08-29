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

// The count is only known once the selection stops, so what crosses is the
// price of a count rather than a price.
export type CoreFeeForInputs = (inputsCount: number) => bigint
