// A locally-broadcast tx still awaiting confirmation. raw is replayed for
// rebroadcast; firstSeenAt drives the rebroadcast/stale-release cadence.
export interface PendingTx {
  txid: string
  raw: Uint8Array
  firstSeenAt: number
  instantLocked: boolean
}