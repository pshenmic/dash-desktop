import {TransactionStatus} from "../enums/TransactionStatus";

export interface TransactionInput {
  value: string,
  n: number,
  addr: string,
  prevTxId: string,
  prevVout: number,
  sequence: number
}

export interface TransactionOutput {
  value: string,
  n: number,
  address: string,
  spentTxId: string,
  spentIndex: number,
  spentHeight: number
}

export interface Transaction {
  address: string
  direction: number
  inAmount: bigint
  outAmount: bigint
  transferAmount: bigint
  usdAmount: string
  date: Date
  size: number
  blockHeight: number
  status: keyof typeof TransactionStatus
  walletId: string
  confirmations: number
  txid: string
  vin: TransactionInput[]
  vout: TransactionOutput[]
  // A DIP-24 lock makes a tx final before any block carries it, so these are
  // not implied by blockHeight and the two move independently.
  instantLocked: boolean
  chainlocked: boolean
  // Whether this wallet broadcast it. Only meaningful while unconfirmed, and
  // null from sources that cannot know — the chain does not record provenance.
  isLocal: boolean | null
}
