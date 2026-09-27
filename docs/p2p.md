# p2p invariants (`src/main/p2p/`)

Four directories, split by what a thing *is*, not what it is about. `utils/` is
pure functions (byte order, x11, pow, header validation, locators) and `store/`
is chain.db plus the in-memory structures over it; neither knows a peer exists.
`net/` (pools, broadcast, peer selection) imports nothing. `sync/` is the only
layer that touches the others, and the only one holding timers and retry state.
`index.ts` is the IPC adapter and holds no logic.

Things the code cannot tell you, and that a plausible-looking change breaks:

- **chain.db is network-scoped and nothing under `p2p/` opens SQLite.** Wallet
  state arrives in the `start` command (`seedUtxos`, `cfilterCursor`) and leaves
  as `blockApplied` / `cursorAdvanced` for main to persist.
- **An address belongs to exactly one pool.** `PoolService.takeAddresses()`
  *moves* rather than copies, because a node dialled twice from one host drops
  both connections.
- **A pool resting under its ready target is intended.** Dead gossip addresses
  are the majority, and their socket setup and teardown run on the thread
  parsing sync responses. Do not fix it by dialling harder.
- **No hardcoded block hashes.** Trust anchors come from `cfcheckpt` or
  `GENESIS`; do not add a checkpoint table.
- **x11 comes from `crypto-toothpick`** (native, WASM fallback) and resolves its
  addon at runtime, so it must stay in `external` in `electron.vite.config.ts`.
  Digests are in wire byte order — convert with `byteOrder.ts`.
- **`FilterMatcher` caches the watch set natively**, so anything mutating
  `WatchSet.items` must leave `revision` bumped.

## Trust anchors and block contents

- **A cfcheckpt vector is checked for length before anything trusts it.** The
  stop hash covers exactly `stopHeight / 1000` anchors; a short one — an empty
  one most of all — leaves every check under it comparing against nothing and
  passing. Agreement across peers is preferred but cannot be required: some +CF
  peers never answer `getcfcheckpt` at all, so one uncontradicted answer
  proceeds with a warning, while contradicting answers keep asking rather than
  picking a side. A pinned pool takes that answer at once — waiting out the race
  would wait on a peer that cannot join.
- **A ChainLock is a statement about a block, not about a height.** `clsig`
  carries the locked hash. Flooring the reorg depth on the height alone pins us
  to whatever branch we happen to hold there, and since the floor then sits at or
  above our tip, every fork is refused and nothing can correct it afterwards —
  restarts included. The hash is compared with ours at that height: matching
  raises `finalityHeight`, differing rewinds, and a lock above our tip is held
  until the tip reaches it. `finalityHeight` only ever names a height we checked.
- **The getheaders locator is never clamped by the ChainLock height.** Locks run
  at or one behind the tip in normal operation, so clamping leaves a locator of
  one hash — our own tip, the single hash a peer that left our branch cannot
  place. It answers from genesis instead, and `ChainWindow.floor()` exists to
  stop that.
- **A batch anchored where we have never been is an answer, not silence.**
  Leaving that peer in the race reads as unresponsive, marks the peers that did
  answer silent, and re-asks the same orphan tip every `HEADER_SYNC_TIMEOUT_MS`
  for as long as the wallet runs. `ORPHAN_VOTE_PEERS` of them rewind a reorg
  window instead — the only signal there is when a lost branch still validates
  and still carries work. Capped by the ready pool, or a pinned one peer wide
  could never reach the quorum and would stay stuck.
- **A block hash proves the header, not the transactions under it.**
  `block.hash()` covers the 80 bytes alone, so a fetched block is checked
  against its merkle root (`utils/merkle.ts`) before it is applied, and refused
  where a duplicated odd tail lets a second transaction list reach that root.

## Difficulty (`utils/difficulty.ts`)

- **Every header's `nBits` is checked against the retarget rule for its era**:
  interval retarget, then KGW, then DGW v3, at the heights in `constants.ts`.
  Three things there look like bugs and are not. The interval retarget spans the
  full interval except at its very first application (Litecoin's correction to
  Bitcoin's off-by-one). Mainnet at or below `DGW_TOLERANCE_HEIGHT` is checked
  against a ±50% band, not for equality, because DGW v1/v2 ran in x87
  `long double` — Dash Core does the same in `ContextualCheckBlockHeader`. And
  testnet has *two* min-difficulty rules with different thresholds, one either
  side of `KGW_ACTIVATION_HEIGHT`.
- **Difficulty is a relative rule, not a trust anchor.** It makes a cheap tail
  spliced onto the real chain unmineable at any depth, which the
  `REORG_MAX_DEPTH` work comparison only covered near the tip. It does not stop
  a chain fabricated from genesis at `POW_LIMIT`.
- **v3 crosses to `crypto-toothpick` once per batch, never per header**
  (`expectedBitsForRange`). A per-block call costs the WASM fallback ~30s over a
  sync. The era dispatch, the min-difficulty branch and `bitsAccepted` stay in
  JS — the last two because they read each header's own gap and a `double`.
- **`DifficultyWindow` is not `ChainWindow`** — far deeper, and seeded with
  blocks 0 and 1, which never arrive over the wire because `GENESIS` anchors the
  chain at height 1.
