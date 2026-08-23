import {Transaction as SDKTransaction} from 'dash-core-sdk'
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

// error carries the first failure of a pass, so an outage is reported once
// instead of once per parent.
export interface PrevOutPassResult {
  resolved: number
  unanswered: number
  error: string | null
}

// One parent read, carrying the outpoints waiting on it: a failed read has to
// stay attached to what it was for.
export interface ParentRead {
  spent: PrevOutRef[]
  parent: SDKTransaction | null
  error: string | null
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
