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
  // What moved on this side of the transition, unsigned. Folded rows carry the
  // largest side, so a move between two of ours nets to the fee and still
  // reports what it moved.
  amountCredits: bigint
  // The two ends, each an address or an identity, ours or not. Null on the end
  // the source did not name.
  sender: string | null
  recipient: string | null
}
