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