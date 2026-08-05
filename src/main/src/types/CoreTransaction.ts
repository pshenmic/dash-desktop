import {Script} from 'dash-core-sdk'
import {Network} from './index'

export type RecipientType = 'p2pkh' | 'p2sh'

export interface DraftInput {
  txId: string
  vOut: number
  script: Script
}

export interface TransferInput extends DraftInput {
  derivationPath: string
  address: string
}

export interface BuildTransferTxParams {
  inputs: DraftInput[]
  toAddress: string
  recipientType: RecipientType
  amountDuffs: bigint
  changeAddress: string
  inputTotal: bigint
}

export interface BuildAssetLockTxParams {
  inputs: DraftInput[]
  amountDuffs: bigint
  creditAddress: string
  changeAddress: string
  inputTotal: bigint
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