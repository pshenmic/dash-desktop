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
  fee: bigint
}
