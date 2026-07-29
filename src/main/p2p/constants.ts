import {Network} from '../src/types'

export interface ChainAnchor {
  height: number
  hash: string
}

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

// Target number of *ready* peers — the real cost knob, since inv traffic only
// flows after a handshake. Measured on testnet: 98% of peers that complete one
// advertise compact filters, so there is no need to over-connect hunting for
// the +CF subset; this only has to clear the races below with margin.
export const POOL_READY_PEERS = 25

// Refill threshold. Below this the pool reopens capacity; between here and
// POOL_READY_PEERS it coasts. Must stay under what the network can supply
export const POOL_MIN_PEERS = 15

// Connection slots while refilling. Most addresses learned from `addr` gossip
// are dead, and a socket that never completes its handshake still holds a slot
// while costing no traffic — so capacity has to exceed the ready target or
// dead sockets crowd out live peers. Measured: 20 slots against an 840-entry
// book reached only 7 ready peers in two minutes, while 36 slots sustained 31.
export const POOL_MAX_CONNECTIONS = 64

// Consecutive refill ticks with no change in ready-peer count before we accept
// that the network has no more to give and stop widening. Without it a supply
// below POOL_MIN_PEERS pins the pool in its refill branch indefinitely —
// measured at 72k connection attempts in 50s, which reads as a port scan to
// the nodes we depend on for locks.
export const POOL_FILL_STALL_LIMIT = 36

// The lock pool runs whenever the process is up, including in rpc mode where
// nothing else about p2p is wanted, so it is sized down to what lock detection
// and broadcast actually need: locks are relayed network-wide, so one peer
// would hear them, and BROADCAST_POLICY only asks for 3 acks. It carries
// `relay: true` and therefore the whole tx inv stream — every peer here is a
// duplicate copy of it, which is why this is the one pool kept small.
export const LOCK_POOL_READY_PEERS = 10
export const LOCK_POOL_MIN_PEERS = 6

// How often the pool refills connections when below the soft minimum.
// 5s matches dash-core-p2p's internal default; lower is wasteful, higher
// makes initial sync slow to find +CF peers.
export const POOL_REFILL_INTERVAL_MS = 5_000

// ── Header sync ─────────────────────────────────────────────────────────────

export const HEADER_RACE_PEERS = 15

export const HEADER_SYNC_TIMEOUT_MS = 30_000

// ── CFilter sync ────────────────────────────────────────────────────────────

export const FILTER_TYPE = 0

// Heights per getcfilters request. <= 1000 per spec; smaller = more round-
// trips, larger = bigger memory spikes per response.
export const CFILTER_BATCH = 900

// Concurrent in-flight cfilter batches. 4 is a reasonable middle ground —
// pipelines well across multiple +CF peers without overwhelming any one.
export const MAX_INFLIGHT_BATCHES = 6

export const CFCHECKPT_RACE_PEERS = 15

export const CFHEADERS_RACE_PEERS = 15

export const CFCHECKPT_RACE_TIMEOUT_MS = 10_000
export const CFHEADERS_RACE_TIMEOUT_MS = 10_000
export const CFILTER_BATCH_TIMEOUT_MS = 10_000
export const BLOCK_REQUEST_TIMEOUT_MS = 10_000

// Stop hashes for cf* requests are capped this far below the synced tip.
// Dash Core silently drops requests for blocks not in its active chain
// (reorgs / peer lag), so anything closer than this fails intermittently.
// Trade-off: larger value = more reliable cfilter requests but longer
// confirmation latency before a wallet sees a new UTXO.
export const SCAN_TIP_DEPTH = 5

// ── Broadcast ───────────────────────────────────────────────────────────────

// Fixed broadcast policy. The wallet does not expose any of these knobs to
// callers — broadcastTransaction takes only a tx hex. Notes on the
// instant-lock fields: current Dash Core ships isdlock (DIP-24) which
// dash-core-p2p doesn't parse yet, so islock can't be a success signal on
// mainnet/testnet today; both flags stay false.
export const BROADCAST_POLICY = {
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
