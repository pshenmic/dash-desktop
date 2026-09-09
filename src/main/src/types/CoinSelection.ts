// Every coin a send may draw on, and the only shape the renderer is offered:
// listing what can be picked and selecting from it are the same set.
export interface SelectableUtxo {
  txid: string
  vout: number
  satoshis: bigint
  address: string
  height: number
}

export interface Outpoint {
  txid: string
  vout: number
}

// How a send was restricted to part of the wallet. An address narrows the pool
// the automatic selection draws from and still lets it pick; an outpoint list
// is the input set itself, spent whole, which is the only way a send can
// consolidate coins an amount would never have reached for.
export type CoreSpendSource =
  | {kind: 'address'; address: string}
  | {kind: 'outpoints'; outpoints: Outpoint[]}

export interface CoinSelectionResult {
  inputs: SelectableUtxo[]
  inputTotal: bigint
  fee: bigint
  change: bigint
}

// The count is only known once the selection stops, so what crosses is the
// price of a count rather than a price.
export type CoreFeeForInputs = (inputsCount: number) => bigint
