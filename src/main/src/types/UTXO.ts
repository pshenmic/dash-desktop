import { Script } from 'dash-core-sdk'

export interface UTXO {
  address: string
  satoshis: bigint
  script: Script
  txId: string
  vOut: number
  // 0 while the output is still in the mempool, matching the block_height the
  // local store writes for an unconfirmed transaction.
  height: number
  // Null only from a source that cannot date the coin — a Dashscan deployment
  // whose utxo endpoint predates the block timestamp.
  timestamp: Date | null
  confirmations: number
}

// What the local store answers a wallet's utxo read with. Separate from the
// p2p seedUtxos shape, which the cfilter worker parses and must not grow
// display-only fields.
export interface UtxoRow {
  txid: string
  vout: number
  address: string
  satoshis: string
  height: number
  // Unix seconds: the block header time, or when a pending tx was recorded.
  blockTime: number
}
