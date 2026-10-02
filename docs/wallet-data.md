# Connection modes (p2p vs rpc)

Read this before any wallet data feature.

`WalletProviderFactory.forWallet()` returns one of two `WalletProvider`
implementations based on the `connectionType` preference. It is resolved per
call, never cached on a service, because the preference changes at runtime:

- **`rpc`** (default) → `DashscanWalletProvider`: hits the Dashscan REST API
  (`DASHSCAN_BASE_URLS`). Mostly xpub-scoped and cursor-paginated —
  `/xpub/transactions`, `/xpub/utxo`, `/xpub/addresses` — and the provider walks
  every page. `/addresses/info` is the one address-batch endpoint, chunked by
  `DASHSCAN_ADDRESS_CHUNK` (100). Before an RPC balance or history read,
  `CoreDiscoveryService` materializes a recent xpub usage scan into `addresses`,
  deriving every row locally from the persisted xpub rather than trusting a
  server-supplied address string. Wire shapes live in `types/Dashscan.ts`, the
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
`block_height = 0` with `is_local = false`, then arms `watchForInstantLock`. Its
committed write and a completed cfilter scan advance the selected wallet's data
revision, so the renderer's existing status poll refreshes the affected Core
caches without waiting for their normal refresh intervals.

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
- **A peer announces a tx once, so the mempool is asked for outright.** An inv
  goes out at first sight and never again, leaving a tx that arrived before the
  wallet opened invisible until a block carries it. A bounded
  `MEMPOOL_SNAPSHOT_PEERS` quorum is queried whenever the active address window
  changes; a disconnected queried peer is replaced. The full responses are still
  matched locally — no BIP37 filter is loaded, so wallet addresses are not
  published to peers. **A peer advertising no `NODE_BLOOM` is passed over**,
  since a node started with bloom filters off disconnects on the request rather
  than answering it.
- **The answer is an ordinary inv, and its fetches are paced.** It can carry the
  peer's whole pool, and each entry costs a getdata to see whose it is, so TX
  hashes queue and leave `MEMPOOL_FETCH_BATCH` at a time — one getdata past 50k
  entries is refused anyway. `clsig` and `isdlock` skip the queue: a delayed one
  is a delayed confirmation. A queued tx whose announcing peer disconnects
  leaves `mempoolSeen` with it, so the next announcement is fetched rather than
  skipped as a duplicate.
- **In `rpc` mode the local row is written but not read back.**
  `DashscanWalletProvider` does not read local SQL and nothing merges pending
  rows into its result — pending transactions reach the UI from Dashscan, which
  reports them itself. Nothing moves the local rows off `block_height = 0` in
  that mode either (no cfilter scan), so they accumulate in `getPendingTxs` and
  the isdlock watch set. Both are open.
