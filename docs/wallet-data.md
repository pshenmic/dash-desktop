# Connection modes (p2p vs rpc)

Read this before any wallet data feature.

`WalletProviderFactory.forWallet()` returns one of two `WalletProvider`
implementations based on the `connectionType` preference. It is resolved per
call, never cached on a service, because the preference changes at runtime:

- **`rpc`** (default) → `DashscanWalletProvider`: hits the Dashscan REST API
  (`DASHSCAN_BASE_URLS`). Mostly xpub-scoped and cursor-paginated —
  `/xpub/transactions`, `/xpub/utxo`, `/xpub/addresses` — and the provider walks
  every page. `/addresses/info` is the one address-batch endpoint, chunked by
  `DASHSCAN_ADDRESS_CHUNK` (100). Wire shapes live in `types/Dashscan.ts`, the
  mapping to our `Transaction` in `utils/dashscanTransactions.ts`.
- **`p2p`** → `P2PWalletProvider`: reads the local SPV store.

Write wallet features against the `WalletProvider` interface so they work in
both modes. **The source decides the address set, not the caller** — that is why
the method is `getWalletTransactions()` and takes no addresses: Dashscan
resolves the xpub server-side, P2P reads by wallet. Both de-dupe by txid, since
one tx touches several owned addresses — see `dedupeTransactions`.
`vin[].value` / `vout[].value` are **DASH decimal strings** in both providers;
duffs live in `inAmount` / `outAmount` / `transferAmount` as `bigint`.

## The lock pool runs in BOTH modes — `connectionType` does not gate it

The p2p utility process owns **two pools**, and only one of them is a mode:

| Pool | Peers | Carries | Lifetime |
|---|---|---|---|
| `lockPool` | relay=**true**, network-scoped | broadcast, InstantSend (`isdlock`) and ChainLock (`clsig`) watching, incoming mempool txs | **always up**, both modes |
| `bulkPool` | relay=false, dnsSeed=false | headers, cfilters, blocks | `p2p` mode only, via `startWalletSync` |

`startLockListen(network, walletId)` is called from `WalletBackend` at boot and
`WalletService` on wallet select with **no `connectionType` check**, so the child
process hears locks even in the default `rpc` mode.

- **Neither provider broadcasts, and locally-signed transactions never go out
  over Dashscan.** `forWallet()` covers *reads* and third-party broadcast; asset
  locks bypass it — `CoreLockService.broadcastAssetLock` calls
  `walletSyncService.broadcastTransaction` directly, in both modes, because the
  lock pool is the only pool that can hear the resulting `isdlock`.
- **A tx must be armed before its lock can arrive.** An ISDLOCK inv requires an
  explicit `getdata`, so `broadcastTransaction` calls `watchForInstantLock(txid)`
  before sending. A tx nobody armed gets its lock seen and dropped.
- **Never reach for `coreSDK.subscribeToTransactions` for a transaction this
  wallet broadcast.** DAPI is a different network path and does not deliver that
  lock in either mode. Use `CoreLockService.waitForInstantLock(txid, timeoutMs)`.
  Chainlocks arrive the same way (`peerclsig` → `chainLocked` message) and have
  their own waiter, `CoreLockService.waitForChainLock(network, minHeight,
  timeoutMs)`, which `AssetLockService` uses as a backstop; they also feed
  `markChainlockedUpTo`.

## Incoming mempool txs (lock pool)

Payments are spotted before any block carries them: `SyncService` matches TX invs
on the lock pool against the addresses shipped in the `listen` command and emits
`incomingTx`; `WalletSyncService.recordIncomingTx` writes the tx at
`block_height = 0` with `is_local = false`, then arms `watchForInstantLock`.

- **An `isdlock` cannot tell you a tx pays you.** It carries `inputs`, `txid`,
  `cycleHash` and `sig` — no outputs, no addresses — and its inv hash is not the
  txid. It is the *finality* signal; discovery has to come from the TX inv, which
  means fetching the tx to see its outputs. Matching happens in the child so the
  mempool never crosses the process boundary.
- **`is_local` is why the migration exists.** `rebroadcastPending` re-pushes
  every unconfirmed tx on a timer; without the filter the wallet would relay a
  stranger's transaction for as long as it stayed unconfirmed.
  `refreshWatchedTxids` deliberately does *not* filter — arming incoming txs is
  what captures their lock. Every peer announces the same tx (~9x measured), so
  `mempoolSeen` dedupes the `getdata`. `[locks] mempool watch: …` reports counts
  every 5 min; `watching 0 address(es)` is what a wallet that never supplied its
  addresses looks like, and is otherwise silent.
- **In `rpc` mode the row is written but never displayed.**
  `DashscanWalletProvider` does not read local SQL and nothing merges pending
  rows into its result, so `getWalletTransactions`/`getWalletBalance` omit them.
  Nothing moves those rows off `block_height = 0` in that mode either (no
  cfilter scan), so they accumulate in `getPendingTxs` and the isdlock watch
  set. Both are open.

## New-transaction notifications

`WalletSyncService.onNewTransaction` fires once per payment, from whichever of
three sightings reaches it first:

1. `broadcastTransaction` — ours, via `recordOptimisticSpend`.
2. `recordIncomingTx` — a mempool match on the lock pool, so this one works in
   `rpc` mode too. **`SyncService.onTx` does not filter out what we broadcast**
   — our own change pays a watched address — so our sends come straight back
   here.
3. `writeAppliedBlock` — for a payment that skipped our mempool view.

**Only the sighting that wrote the SQL row reports it.** `recordPendingTx`
answers whether it inserted, `applyBlock` answers with the transactions it had
no row for. Do not add a set of seen txids alongside this: it would forget on
restart, and `rebroadcastPending` re-entering `broadcastTransaction` every
minute is already covered.

**No path may claim a txid before it acts.** A mempool sighting that beats
`recordOptimisticSpend` reads the right direction anyway — the inputs it writes
carry the outpoints they spend, which join to this wallet's own earlier outputs,
so `prev.is_mine` gives `inAmount`. Pinned by
`tests/unit/newTransactionSightings.test.ts`.

**The block gate is `block.height >= status.tipHeight`, and the sync phase looks
like the right test but is not.** Tip-follow re-enters the scan
(`emitStatus('cfilters')` on every new header), so a live block is applied under
`syncing-cfilters` like any catch-up block; `'synced'` would suppress every real
notification and pass only a drain backlog. The height is read when the block
arrives, not when its queued write lands — by then the tip has moved.

L2 is separate: `PlatformExplorerProvider.walk` returns the hashes it had not
stored, `PlatformHistoryService` folds them through `mergePlatformTransactions`
(one transition is walked from both ends) and reports only those dated after the
process started — otherwise importing a seed announces its whole history.
