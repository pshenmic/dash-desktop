import {Network} from '../src/types'
import type {ChainAnchor} from './types/chain'
import type {PoolServiceEventMap} from './types/pool'

// Key width of the height-indexed header records in ChainStore.
export const HEIGHT_KEY_WIDTH = 12

export const HASH_LEN = 32

export const MB = 1024 * 1024

export const POW_LIMIT_BITS = 0x1e0fffff
export const MAX_FUTURE_BLOCK_TIME = 2 * 60 * 60

export const INV_TYPE_NAMES: Record<number, string> = {
  0: 'ERROR', 1: 'TX', 2: 'BLOCK', 3: 'FILTERED_BLOCK',
  16: 'DSTX', 29: 'CLSIG', 30: 'ISLOCK', 31: 'ISDLOCK',
}

export const FORWARDED_EVENTS: Array<keyof PoolServiceEventMap> = [
  'peerconnect', 'peerready', 'peerdisconnect', 'peerversion',
  'peerheaders', 'peerinv', 'peerblock', 'peeraddr',
  'peercfcheckpt', 'peercfheaders', 'peercfilter',
  'peerislock', 'peerisdlock', 'peerclsig',
  'seederror',
]

export const GENESIS: Record<Network, ChainAnchor> = {
  mainnet: {
    height: 1,
    hash: '000007d91d1254d60e2dd1ae580383070a4ddffa4c64c2eeb4a2f9ecc0414343',
  },
  testnet: {
    height: 1,
    hash: '0000047d24635e347be3aaaeb66c26be94901a2f962feccd4f95090191f208c1',
  },
}

// ── Peer pool ───────────────────────────────────────────────────────────────

// Measured on testnet: 98% of peers completing a handshake advertise compact
// filters, so this only has to clear the races below — not hunt for +CF peers.
export const POOL_READY_PEERS = 25

// Must stay under what the network can actually supply, or the pool never
// leaves its refill branch.
export const POOL_MIN_PEERS = 15

// Must exceed the ready target: most gossiped addresses are dead, and a socket
// that never completes its handshake holds a slot anyway. Measured against an
// 840-entry book — 20 slots reached 7 ready in two minutes, 36 sustained 31.
export const POOL_MAX_CONNECTIONS = 64

// Refill ticks with no gain in ready peers before we stop widening. Without it
// a supply below POOL_MIN_PEERS pins the pool in refill — measured at 72k
// connection attempts in 50s, which reads as a port scan to the nodes we
// depend on for locks.
export const POOL_FILL_STALL_LIMIT = 72

// Sized down because this pool carries `relay: true`, so every peer on it is a
// duplicate copy of the whole tx inv stream. Locks are relayed network-wide and
// BROADCAST_POLICY asks for 3 acks, so a small pool covers both jobs.
export const LOCK_POOL_READY_PEERS = 10
export const LOCK_POOL_MIN_PEERS = 6

// Without its own cap this pool inherits POOL_MAX_CONNECTIONS and dials 60+
// sockets to seat 10 peers, competing with the app's own HTTPS traffic.
export const LOCK_POOL_MAX_CONNECTIONS = 24

// Slots kept above the ready target once coasting. A clamp of exactly the
// target leaves no room to replace a socket still timing out — measured a lock
// pool resting at 6-7 ready against a target of 10 for want of this.
export const POOL_CONNECT_HEADROOM = 8

// Matches dash-core-p2p's internal default; higher makes initial sync slow to
// find +CF peers.
export const POOL_REFILL_INTERVAL_MS = 5_000

// ── Header sync ─────────────────────────────────────────────────────────────

export const HEADER_RACE_PEERS = 15

export const HEADER_SYNC_TIMEOUT_MS = 30_000

// ── CFilter sync ────────────────────────────────────────────────────────────

export const FILTER_TYPE = 0

// Capped at 1000 per spec; smaller costs round-trips, larger spikes memory per
// response.
export const CFILTER_BATCH = 900

export const MAX_INFLIGHT_BATCHES = 10

export const CFCHECKPT_RACE_PEERS = 15

export const CFHEADERS_RACE_PEERS = 15

export const CFCHECKPT_RACE_TIMEOUT_MS = 10_000
export const CFHEADERS_RACE_TIMEOUT_MS = 10_000
export const CFILTER_BATCH_TIMEOUT_MS = 10_000
export const BLOCK_REQUEST_TIMEOUT_MS = 10_000

// How far below the synced tip cf* stop hashes are capped. Dash Core silently
// drops requests for blocks not in its active chain, so anything closer fails
// intermittently — at the cost of confirmation latency.
export const SCAN_TIP_DEPTH = 5

// ── Broadcast ───────────────────────────────────────────────────────────────

// Defaults, overridable per call via BroadcastPolicyOverrides. With both
// instant-lock flags false a broadcast settles once the tx has spread, well
// before a lock could arrive — so `instantLocked` is then absence of evidence,
// not evidence of absence. See waitedForLock.
export const BROADCAST_POLICY = {
  // Counts peers we pushed to, not just those answering an inv with getdata:
  // observed on testnet, that getdata often never comes, so a threshold on acks
  // alone is unreachable and every send burns the full timeout.
  minPeerAcks: 3,
  waitForInstantLock: false,
  requireInstantLock: false,
  peerWaitMs: 10_000,
  timeoutMs: 30_000,
  rebroadcastIntervalMs: 15_000,
  maxRebroadcasts: 2,
  unsolicitedPushAfterMs: 5_000,
  failOnReject: true,
} as const
