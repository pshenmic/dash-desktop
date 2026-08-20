import {TransactionStatus} from "../enums/TransactionStatus";

export interface TransactionInput {
  value: string,
  n: number,
  addr: string,
  prevTxId: string,
  prevVout: number,
  sequence: number
}

// The outpoint an input spends, when the output behind it is not one of ours and
// so was never stored.
export interface PrevOutRef {
  prevTxid: string
  prevVout: number
}

// Carries the spending transaction as well, so a resolution pass can stop on a
// transaction boundary instead of leaving one of them half described.
export interface UnresolvedInput extends PrevOutRef {
  txid: string
}

// address is '' rather than null for a script no address can be derived from —
// null is what marks the outpoint as still unresolved.
export interface ResolvedPrevOut extends PrevOutRef {
  address: string
  satoshis: string
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
