import {Network} from '../src/types'

// position of that block in Dash Core's height numbering.
export interface ChainAnchor {
  height: number
  hash: string
}

export const GENESIS: Record<Network, ChainAnchor> = {
  mainnet: {
    height: 1,
    hash: '00000ffd590b1485b3caadc19b22e6379c733355108f107a430458cdf3407ab6',
  },
  testnet: {
    height: 1,
    hash: '0000047d24635e347be3aaaeb66c26be94901a2f962feccd4f95090191f208c1',
  },
}

// ── Peer pool ───────────────────────────────────────────────────────────────

// Upper bound on the connection pool. dash-core-p2p will only connect this
// many simultaneously; extras stay in its address book.
export const POOL_MAX_SIZE = 256

// How often the pool refills connections when below the soft minimum.
// 5s matches dash-core-p2p's internal default; lower is wasteful, higher
// makes initial sync slow to find +CF peers.
export const POOL_REFILL_INTERVAL_MS = 5_000

// ── Header sync ─────────────────────────────────────────────────────────────

// Number of peers raced for each getheaders round. Higher = more redundancy
// against slow peers, but more wasted bandwidth (only one wins per round).
export const HEADER_RACE_PEERS = 12

// Round timeout. If no peer responds in this window, the race is aborted
// and a new one starts from the same locator.
export const HEADER_SYNC_TIMEOUT_MS = 30_000

// ── CFilter sync ────────────────────────────────────────────────────────────

// BIP 158 filter type. 0 = basic filter (P2PKH + P2SH outputs). Currently
// the only type Dash Core serves.
export const FILTER_TYPE = 0

// Heights per getcfilters request. <= 1000 per spec; smaller = more round-
// trips, larger = bigger memory spikes per response.
export const CFILTER_BATCH = 800

// Concurrent in-flight cfilter batches. 4 is a reasonable middle ground —
// pipelines well across multiple +CF peers without overwhelming any one.
export const MAX_INFLIGHT_BATCHES = 4

// Number of peers raced for cfcheckpt. Same logic as HEADER_RACE_PEERS but
// only against the +CF subset of the pool.
export const CFCHECKPT_RACE_PEERS = 12

export const CFCHECKPT_RACE_TIMEOUT_MS = 15_000
export const CFHEADERS_RACE_TIMEOUT_MS = 15_000
export const CFILTER_BATCH_TIMEOUT_MS = 15_000
export const BLOCK_REQUEST_TIMEOUT_MS = 15_000

// Stop hashes for cf* requests are capped this far below the synced tip.
// Dash Core silently drops requests for blocks not in its active chain
// (reorgs / peer lag), so anything closer than this fails intermittently.
// Trade-off: larger value = more reliable cfilter requests but longer
// confirmation latency before a wallet sees a new UTXO.
export const SCAN_TIP_DEPTH = 100
