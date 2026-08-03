import {Script} from 'dash-core-sdk'
import {Network} from './index'

export type RecipientType = 'p2pkh' | 'p2sh'

export interface TransferInput {
  txId: string
  vOut: number
  script: Script
  derivationPath: string
  address: string
}

export interface BuildSignedTransferParams {
  inputs: TransferInput[]
  toAddress: string
  recipientType: RecipientType
  amount: bigint
  changeAddress: string
  inputTotal: bigint
  seed: Uint8Array
  network: Network
}