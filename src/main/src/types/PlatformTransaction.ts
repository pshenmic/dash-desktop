export type PlatformTxStatus = 'SUCCESS' | 'FAIL'

// One end of a transition and what it moved there: an address or an identity,
// ours or not, with the credits that side gained or paid.
export interface TransitionEnd {
  source: string
  amount: bigint
}

// One state transition that moved this wallet's credits. Amounts are credits,
// not duffs, and `hash` is a state transition hash, not a Core txid — nothing
// here is interchangeable with a `Transaction`.
export interface NewPlatformTransaction {
  transaction: PlatformTransaction
  assetLockTxid: string | null
}

export interface PlatformTransaction {
  walletId: string
  hash: string
  type: string
  date: Date
  // Null on a row sourced from identity transfers, which report neither.
  blockHeight: number | null
  status: PlatformTxStatus | null
  error: string | null
  gasCredits: bigint
  netCredits: bigint
  amountCredits: bigint
  sender: TransitionEnd[]
  recipient: TransitionEnd[]
}
