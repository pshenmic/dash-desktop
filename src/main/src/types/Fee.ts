// feeDuffs is what L1 charges on top of the amount, feeCredits what L2 takes
// out of it. An L1 -> L2 transfer is two transactions and carries both; every
// other operation carries one, and null means it cannot be priced yet — no
// identity picked, no amount typed. maxPerTx and noteLimit are pool-spend
// facts: nothing else is capped by anything but the balance.
export interface OperationFee {
  feeCredits: bigint | null
  feeDuffs: bigint | null
  maxPerTx: bigint | null
  noteLimit: number | null
}
