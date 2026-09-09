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
}
