export type PlatformTxStatus = 'SUCCESS' | 'FAIL'

// One state transition that moved this wallet's credits. Amounts are credits,
// not duffs, and `hash` is a state transition hash, not a Core txid — nothing
// here is interchangeable with a `Transaction`.
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
  // Signed net across every address and identity of this wallet the transition
  // touched, so a move between two of them leaves the fee as the only cost.
  netCredits: bigint
  // The wallet address or identity this moved, null once the transition touched
  // more than one of them.
  subject: string | null
  // The other side, when the source names one. Identity transfers do; an
  // address transition does not carry its counterparty.
  counterparty: string | null
}
