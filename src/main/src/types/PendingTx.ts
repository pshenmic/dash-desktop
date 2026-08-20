// A tx still awaiting confirmation, ours or an incoming one the lock pool saw.
// raw is replayed for rebroadcast; firstSeenAt drives that cadence.
export interface PendingTx {
  txid: string
  raw: Uint8Array
  firstSeenAt: number
  instantLocked: boolean
  // Only our own broadcasts may be re-pushed.
  isLocal: boolean
}