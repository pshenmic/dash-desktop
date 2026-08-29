import {Script} from 'dash-core-sdk'
import {Network} from './Network'

export type RecipientType = 'p2pkh' | 'p2sh'

export interface TransferInput {
  txId: string
  vOut: number
  script: Script
  derivationPath: string
  address: string
}

export interface TransferInputSelection {
  transferInputs: TransferInput[]
  inputTotal: bigint
  changeAddress: string
  feeDuffs: bigint
}

export interface BuildSignedTransferParams {
  inputs: TransferInput[]
  toAddress: string
  recipientType: RecipientType
  amount: bigint
  changeAddress: string
  inputTotal: bigint
  feeDuffs: bigint
  seed: Uint8Array
  network: Network
}
