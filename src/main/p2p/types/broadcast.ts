// What the broadcast observed on the wire. Crosses IPC to the renderer, so
// peers are flattened to "host:port" — Peer instances don't survive
// structuredClone. Defaults live in constants.ts (BROADCAST_POLICY).

export interface BroadcastRejection {
  peer: string
  ccode: number
  reason: string
}

export interface BroadcastPolicyOverrides {
  waitForInstantLock?: boolean
  requireInstantLock?: boolean
  timeoutMs?: number
}

export interface BroadcastResult {
  txid: string
  peersInvited: number
  peersAcked: string[]
  // Peers holding the tx bytes: those that asked plus those we pushed to.
  peersDelivered: string[]
  peersPropagated: string[]
  instantLocked: boolean
  islockHex: string | null
  lockLatencyMs: number | null
  waitedForLock: boolean
  rejections: BroadcastRejection[]
  durationMs: number
}