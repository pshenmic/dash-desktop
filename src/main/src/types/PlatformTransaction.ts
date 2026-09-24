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
  // The ends, each an address or an identity, ours or not: one transition can
  // be paid by several and pay several. Empty where no source named that end —
  // a walk only ever reports the address or identity it asked about.
  sender: TransitionEnd[]
  recipient: TransitionEnd[]
}

// A shielded transition this wallet holds no note side for yet, carrying the
// fields every source row of it reports alike.
export interface ShieldedGap {
  hash: string
  type: string
  date: Date
  blockHeight: number | null
  status: PlatformTxStatus | null
  gasCredits: bigint
}
