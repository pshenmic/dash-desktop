import {Network} from '../src/types/Network'
import type {ChainAnchor} from './types/chain'
import type {PoolServiceEventMap} from './types/pool'

// Key width of the height-indexed header records in ChainStore.
export const HEIGHT_KEY_WIDTH = 12

export const HASH_LEN = 32

export const POW_LIMIT_BITS = 0x1e0fffff
export const MAX_FUTURE_BLOCK_TIME = 2 * 60 * 60

export const INV_TYPE_NAMES: Record<number, string> = {
  0: 'ERROR', 1: 'TX', 2: 'BLOCK', 3: 'FILTERED_BLOCK',
  16: 'DSTX', 29: 'CLSIG', 30: 'ISLOCK', 31: 'ISDLOCK',
}

export const FORWARDED_EVENTS: Array<keyof PoolServiceEventMap> = [
  'peerconnect', 'peerready', 'peerdisconnect', 'peerversion',
  'peerheaders', 'peerinv', 'peerblock', 'peeraddr', 'peertx',
  'peercfcheckpt', 'peercfheaders', 'peercfilter',
  'peerislock', 'peerisdlock', 'peerclsig',
  'seederror',
]

// Forwarded events that say nothing about whether the far end is reachable: a
// dial that never completes emits peerdisconnect just as a live peer leaving does.
export const DIAL_LIFECYCLE_EVENTS: ReadonlySet<keyof PoolServiceEventMap> = new Set([
  'peerconnect', 'peerdisconnect', 'seederror',
])

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
// that never completes its handshake holds a slot anyway.
export const POOL_MAX_CONNECTIONS = 128

// Refill ticks with no gain in ready peers before we stop widening. A supply
// below POOL_MIN_PEERS otherwise pins the pool in refill, and at ~72k connection
// attempts in 50s that reads as a port scan to the nodes we depend on for locks.
export const POOL_FILL_STALL_LIMIT = 72

// Sized down because this pool carries `relay: true`, so every peer on it is a
// duplicate copy of the whole tx inv stream. Locks are relayed network-wide and
// BROADCAST_POLICY needs a handful of peers, so a small pool covers both jobs.
export const LOCK_POOL_READY_PEERS = 10
export const LOCK_POOL_MIN_PEERS = 6

// Without its own cap this pool inherits POOL_MAX_CONNECTIONS and dials 60+
// sockets to seat 10 peers, competing with the app's own HTTPS traffic.
export const LOCK_POOL_MAX_CONNECTIONS = 24

// Slots kept above the ready target once coasting. A clamp of exactly the target
// leaves no room to replace a socket still timing out, so the pool rests under.
export const POOL_CONNECT_HEADROOM = 8

// Matches dash-core-p2p's internal default; higher makes initial sync slow to
// find +CF peers.
export const POOL_REFILL_INTERVAL_MS = 5_000

// Refill ticks between reports while a pool is under its minimum. Past
// POOL_FILL_STALL_LIMIT the refill branch goes quiet, so without this an empty
// address book is indistinguishable from a healthy coasting pool.
export const POOL_SHORT_REPORT_TICKS = 12

// Spare addresses a pool keeps for itself before any surplus moves to another pool.
export const POOL_ADDRESS_RESERVE = 100

// Refill ticks between dial-churn reports. Most gossiped addresses are dead, so
// a line per failed dial is ~19k lines a day that bury everything else — but the
// rate is the signal that says whether discovery is healthy, so it is counted
// and reported rather than dropped.
export const POOL_DIAL_REPORT_TICKS = 60

// Refill ticks with nothing connected before the built-in peers are dialled.
export const POOL_FALLBACK_TICKS = 2

// Nothing else probes a peer: dash-core-p2p answers ping but never sends one,
// and node sets no socket timeout — so a peer that vanished with the link (a
// VPN dropping, a laptop sleeping) never closes, never fires peerdisconnect, and
// holds its slot until the process restarts. This hands the OS the job.
export const PEER_KEEPALIVE_DELAY_MS = 60_000

// Total silence across every peer in a pool, after which they are assumed dead
// with the link rather than merely quiet. Peers gossip inv continuously, so this
// only trips when the path to all of them broke at once.
export const POOL_SILENCE_TIMEOUT_MS = 90_000

// Dialled when a pool has produced no live peer at all: a resolver that cannot
// answer the single mainnet DNS seed — or answers it with rewritten records —
// and the bulk pool, which runs no DNS of its own and lives off the lock pool's
// surplus. Harvested over DoH, one per /16 so no single operator carries it.
export const FALLBACK_PEERS: Record<Network, string[]> = {
  mainnet: [
    '46.101.187.72:9999',
    '188.40.108.88:9999',
    '134.209.176.109:9999',
    '185.8.107.195:9999',
    '178.208.87.221:9999',
    '104.238.179.122:9999',
    '167.99.65.122:9999',
    '37.27.199.15:9999',
    '8.219.196.16:9999',
    '93.115.172.39:9999',
    '138.197.161.165:9999',
    '45.76.236.39:9999',
    '132.243.197.21:9999',
    '139.59.56.7:9999',
    '46.4.162.101:9999',
    '168.119.57.12:9999',
    '159.65.2.7:9999',
    '65.21.237.225:9999',
    '91.198.108.39:9999',
    '178.63.121.132:9999',
  ],
  testnet: [
    '158.160.14.115:19999',
    '46.224.41.173:19999',
    '68.67.122.4:19999',
    '68.67.122.7:19999',
    '68.67.122.13:19999',
    '68.67.122.16:19999',
    '68.67.122.23:19999',
    '68.67.122.26:19999',
    '68.67.122.38:19999',
    '68.67.122.59:19999',
  ],
}

// ── Header sync ─────────────────────────────────────────────────────────────

// A latency hedge, not a throughput knob: the response that counts is the first
// to arrive, so the wait is the minimum over the peers asked. Roughly 3 answer
// whatever the width, and a narrow sample is more often won by a slow peer.
export const HEADER_RACE_PEERS = 10

export const HEADER_SYNC_TIMEOUT_MS = 30_000

// Past 'synced' the tip only moves on unsolicited `headers` pushes, which need a
// peer that honours sendheaders. A peer set where none does freezes the tip.
export const HEADER_STALL_TIMEOUT_MS = 10 * 60_000
export const HEADER_STALL_CHECK_MS = 60_000

// Cleared whenever headers land, so this only caps a run of unanswered chases.
export const ANNOUNCE_DEDUPE_LIMIT = 256

// Mempool txids already fetched. Every lock-pool peer announces the same tx, so
// without this each one costs a getdata; measured at ~9 duplicates per tx.
export const MEMPOOL_SEEN_LIMIT = 20_000

// A wallet nobody pays would otherwise log nothing at all, leaving a broken
// watch indistinguishable from an idle one.
export const MEMPOOL_REPORT_INTERVAL_MS = 5 * 60_000

// ── CFilter sync ────────────────────────────────────────────────────────────

export const FILTER_TYPE = 0

// What the genesis filter header chains from — BIP 157 starts the chain on the
// zero hash. Read-only; nothing derives from it but the height-1 header.
export const NO_PREV_FILTER_HEADER = new Uint8Array(HASH_LEN)

// Capped at 1000 per spec; smaller costs round-trips, larger spikes memory per
// response.
export const CFILTER_BATCH = 900

export const MAX_INFLIGHT_BATCHES = 10

// cfheaders chunks requested at once. The walk is a round trip per 1000 blocks
// and nothing else — neither CPU nor bandwidth is near its limit while one is
// outstanding — so this is what decides how long the phase takes.
export const MAX_INFLIGHT_CFHEADERS = 10

// Peers asked for a given cfilter batch. Unlike the cf* races below, one request
// draws CFILTER_BATCH separate cfilter messages back per peer, so every peer past
// the first duplicates the largest stream in the sync. Above 1 only to hedge a
// peer that stalls mid-batch.
export const CFILTER_BATCH_PEERS = 2

// Timer ticks a batch may go without a single filter landing before it is
// abandoned and its range rebuilt. A batch carrying a height whose hash the
// chain index lacks can never complete, and re-racing it forever pins the drain
// cursor — so restarting the range beats asking a 25th peer the same question.
export const CFILTER_BATCH_MAX_STALLS = 6

export const CFCHECKPT_RACE_PEERS = 5

export const CFHEADERS_RACE_PEERS = 5

// A peer that is going to answer a cf* request answers in tens of milliseconds;
// one that is going to stay silent never answers at all. These bound how long
// silence costs before another peer is asked, so they are sized for the retry,
// not for a slow peer.
export const CFCHECKPT_RACE_TIMEOUT_MS = 5_000
export const CFHEADERS_RACE_TIMEOUT_MS = 5_000
export const CFILTER_BATCH_TIMEOUT_MS = 5_000
export const BLOCK_REQUEST_TIMEOUT_MS = 5_000

// How far below the synced tip cf* stop hashes are capped. Dash Core silently
// drops requests for blocks not in its active chain, so a stop hash peers have
// not seen yet costs a batch timeout. Each block of depth is ~2.5 minutes of
// latency before a received payment is scanned.
export const SCAN_TIP_DEPTH = 1

// ── Reorg ───────────────────────────────────────────────────────────────────

// How far back a competing branch may fork before we refuse it outright, and
// the depth of the recent-header window. ChainLocks are the tighter bound.
export const REORG_MAX_DEPTH = 24

// Consecutive tip heights in a getheaders locator before it starts doubling.
export const LOCATOR_DENSE_HEIGHTS = 10

// ── Broadcast ───────────────────────────────────────────────────────────────

// Defaults, overridable per call via BroadcastPolicyOverrides. With both
// instant-lock flags false a broadcast settles once the tx has spread, well
// before a lock could arrive — so `instantLocked` is then absence of evidence,
// not evidence of absence. See waitedForLock.
export const BROADCAST_POLICY = {
  // Counts peers we pushed to, not just those answering an inv with getdata:
  // observed on testnet, that getdata often never comes, so a threshold on acks
  // alone is unreachable and every send burns the full timeout.
  minPeerAcks: 2,
  // Peers deliberately left uninvited. Core does not relay a tx back toward a
  // peer that announced it, so a pool we invite in full can never show us
  // propagation — these are the only nodes whose inv for our txid proves the tx
  // reached a mempool rather than just a socket.
  witnessPeers: 2,
  waitForInstantLock: false,
  requireInstantLock: false,
  peerWaitMs: 10_000,
  timeoutMs: 30_000,
  rebroadcastIntervalMs: 15_000,
  maxRebroadcasts: 2,
  unsolicitedPushAfterMs: 5_000,
  failOnReject: true,
} as const
