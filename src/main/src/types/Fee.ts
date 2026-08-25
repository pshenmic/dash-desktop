// Every operation the wallet can put a price on. Mirrors the renderer's
// TransferOperation values, which cross as plain strings.
export type FeeOperation =
  | 'coreSend'
  | 'assetLockFunding'
  | 'assetLockShield'
  | 'identityRegister'
  | 'identityTopUpL1'
  | 'addressFundsTransfer'
  | 'identityTopUp'
  | 'identityCreate'
  | 'addressWithdrawal'
  | 'shield'
  | 'identityToAddress'
  | 'identityToIdentity'
  | 'identityWithdrawal'
  | PoolSpendOperation

export type PoolSpendOperation =
  | 'shieldedTransfer'
  | 'unshield'
  | 'shieldedWithdrawal'
  | 'identityCreateFromPool'

// What the user chose, and nothing derived from it. Which of these an
// operation reads is estimateFee's business, not the caller's.
export interface FeeParams {
  amountCredits: bigint
  recipient: string
  sourceAddress: string | null
  identityId: string | null
  // Restricts a pool spend to one shielded address's notes.
  noteIndexes: number[] | null
}

// An operation is priced in credits (L2) or duffs (L1), never both, and both
// are null while it cannot be priced yet. maxPerTx and noteLimit are pool-spend
// facts: nothing else is capped by anything but the balance.
export interface OperationFee {
  feeCredits: bigint | null
  feeDuffs: bigint | null
  maxPerTx: bigint | null
  noteLimit: number | null
}

// A transition funded by platform addresses, minus the input count that only
// the selection can supply.
export type SelectionQuery =
  | {kind: 'addressWithdrawal'}
  | {kind: 'identityCreateFromAddresses'}
  | {kind: 'identityTopUpFromAddresses'; identityId: string}
