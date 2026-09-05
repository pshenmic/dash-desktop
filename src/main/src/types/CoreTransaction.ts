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

// One output of a send, as the caller named it. Unlike a platform transition
// nothing is keyed by address, so the same address twice is two payments.
export interface CoreRecipient {
  address: string
  amountDuffs: bigint
}

// The same output once its script kind is known, which only the network the
// send runs on can decide.
export interface TransferOutput extends CoreRecipient {
  recipientType: RecipientType
}

export interface TransferInputSelection {
  transferInputs: TransferInput[]
  inputTotal: bigint
  changeAddress: string
  feeDuffs: bigint
}

export interface BuildSignedTransferParams {
  inputs: TransferInput[]
  outputs: TransferOutput[]
  changeAddress: string
  inputTotal: bigint
  feeDuffs: bigint
  seed: Uint8Array
  network: Network
}
