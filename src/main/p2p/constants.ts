import {Network} from '../src/types/Network'
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
  'peerheaders', 'peerinv', 'peerblock', 'peeraddr', 'peertx',
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
export const POOL_MAX_CONNECTIONS = 128

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

// Refill ticks between reports while a pool is under its minimum. Past
// POOL_FILL_STALL_LIMIT the refill branch goes quiet, so without this an empty
// address book is indistinguishable from a healthy coasting pool.
export const POOL_SHORT_REPORT_TICKS = 12

// Spare addresses a pool keeps for itself before any surplus moves to another pool.
export const POOL_ADDRESS_RESERVE = 100

// Refill ticks with nothing connected before the built-in peers are dialled.
export const POOL_FALLBACK_TICKS = 2

// Dialled when a pool has produced no live peer at all. Two cases reach it: a
// resolver that cannot answer the single mainnet DNS seed — or answers it with
// rewritten records — and the bulk pool, which runs no DNS of its own and now
// only receives the lock pool's surplus, so it can start with nothing.
// Harvested from the seeds over DoH, one per /16 so no single operator carries
// the list.
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

export const HEADER_RACE_PEERS = 15

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

// Capped at 1000 per spec; smaller costs round-trips, larger spikes memory per
// response.
export const CFILTER_BATCH = 900

export const MAX_INFLIGHT_BATCHES = 10

// Peers asked for a given cfilter batch. Unlike the cf* races above, one
// request draws CFILTER_BATCH separate cfilter messages back per peer, so this
// multiplies the largest stream in the sync — every peer beyond the first sends
// filters that arrive after the batch already has them and are dropped. Kept
// above 1 only to hedge a peer that stalls mid-batch; the batch timer rotates
// to untried peers, so a stall costs latency rather than the scan.
export const CFILTER_BATCH_PEERS = 2

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
