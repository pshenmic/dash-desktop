export const SEQUENCE_FINAL = 0xffffffff

export const DUFFS_PER_DASH = 100_000_000n
export const CORE_TRANSFER_FEE_DUFFS = 10_000n
export const CORE_FEE_PER_BYTE = 1

// A coinbase input names no parent transaction.
export const COINBASE_PREV_TXID = '0'.repeat(64)

// Dash has no reject message, so absence of confirmation is never proof of
// failure — a tx is re-pushed until a block or lock settles it, never timed out.
export const REBROADCAST_INTERVAL_MS = 60_000

// Transactions per prev-out resolution page, and how many of the DAPI reads
// behind a page run at once. A page is a step of the walk, not a cap on it.
export const PREVOUT_RESOLVE_BATCH = 50
export const PREVOUT_RESOLVE_CONCURRENCY = 5

// The instant lock usually arrives within seconds; the chain-lock fallback can
// take minutes, hence the generous timeout.
export const IDENTITY_LOCK_TIMEOUT_MS = 15 * 60 * 1000

// Backstop on the clsig wait in the chain-lock fallback. The lock pool wakes
// that loop, so this covers the two cases the pool cannot: no peers, and DAPI
// still reporting a transaction unlocked that our pool already saw locked —
// where waiting for the *next* clsig would cost a whole block interval.
export const CHAIN_LOCK_BACKSTOP_MS = 45 * 1000

// How long getPeers waits for the utility process to answer. The reply is a
// synchronous read off the pools, so anything near this means the child is
// wedged and an empty list beats a hung IPC call.
export const PEER_INFO_TIMEOUT_MS = 5_000

// Sweeps expired entries out of the isdlock watch set. The rebroadcast loop
// does this too, but only runs in p2p mode, so without it an rpc-mode wallet
// keeps the worker fetching isdlocks nobody is waiting on.
export const LOCK_WATCH_SWEEP_INTERVAL_MS = 5 * 60 * 1000

// Outlives the asset-lock timeout above, so an arm never expires under a live
// waiter. Past it nothing is waiting and staying armed only makes the worker
// fetch isdlock objects it will discard.
export const LOCK_WATCH_TTL_MS = 20 * 60 * 1000
