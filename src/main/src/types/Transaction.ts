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
}
