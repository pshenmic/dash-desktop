// Domain types for the P2P broadcast subsystem. Result captures what we
// observed on the wire. Crosses the IPC boundary (utility -> main ->
// renderer), so peers are flattened to "host:port" strings — Peer
// instances don't survive structuredClone. Policy values are hardcoded
// in p2p/constants.ts (BROADCAST_POLICY) — not exposed to callers.

export interface BroadcastRejection {
  peer: string
  ccode: number
  reason: string
}

export interface BroadcastResult {
  txid: string
  peersInvited: number
  peersAcked: string[]
  peersPropagated: string[]
  instantLocked: boolean
  rejections: BroadcastRejection[]
  durationMs: number
}