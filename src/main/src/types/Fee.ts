// An operation is priced in credits (L2) or duffs (L1), never both, and both
// are null while it cannot be priced yet — no identity picked, no amount typed.
// maxPerTx and noteLimit are pool-spend facts: nothing else is capped by
// anything but the balance.
export interface OperationFee {
  feeCredits: bigint | null
  feeDuffs: bigint | null
  maxPerTx: bigint | null
  noteLimit: number | null
}
