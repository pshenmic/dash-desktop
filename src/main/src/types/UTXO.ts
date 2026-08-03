import { Script } from 'dash-core-sdk'

export interface UTXO {
  address: string
  satoshis: bigint
  script: Script
  txId: string
  vOut: number
}
