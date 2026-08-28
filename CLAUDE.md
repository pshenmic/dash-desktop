# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Commands

`yarn` is the package manager (`yarn.lock` is the source of truth); scripts are
in `package.json`. A stray `pnpm-lock.yaml` may appear in the tree — ignore it,
and **never run `pnpm install`**: it relocates the yarn-installed `node_modules`
and breaks the install.

### Verifying a change (the green gate)

No single command says "is it good". A change is verified only when ALL of:

1. `npx tsc --noEmit -p tsconfig.node.json` (main + preload)
2. `npx tsc --noEmit -p tsconfig.web.json` (renderer)
3. `npx tsc --noEmit -p tests/tsconfig.json` (`tests/`)
4. `npx vitest run`
5. `npx electron-vite build`

`electron-vite build` emits many `@fontsource/manrope … didn't resolve at build
time` warnings — pre-existing and harmless. Only non-font errors matter.

**Step 3 exists because `tests/` is in neither app project.** vitest strips
types rather than checking them, so a test can pass at runtime while being
type-broken. `tests/tsconfig.json` covers `tests/` plus both `src` trees; being
named `tsconfig.json` also makes editors resolve it, which stops phantom "BigInt
literals are not available" errors.

## Architecture

An Electron desktop wallet for Dash: electron-vite, React 19, TypeScript.

### Main process (`src/main/`)

`src/main/index.ts` creates the `BrowserWindow`, registers the `dark-mode:*` and
`saveTextFile` handlers, then calls `WalletBackend.start()`.
`src/main/src/WalletBackend.ts` is the real backend: `start()` runs migrations,
constructs DAOs/services, and **registers every wallet IPC handler directly**
via `ipcMain.handle(...)` in `initHandlers()`. There is no `routes.ts`,
`handlers.ts`, or `backend.ts`.

Two subsystems run in their own **Electron utility process**, talking to main by
message passing. A new utility-process entry must be added to the `input` map in
`electron.vite.config.ts`.

- `src/main/p2p/` — SPV, forked from `WalletSyncService`: two peer pools (see
  "Connection modes"), header/cfilter sync, broadcast. `p2p/types/messages.ts`.
  Read "p2p invariants" before changing it.
- `src/main/platform/` — all L2 work off the main thread: identity, asset lock,
  address, fee, broadcast, and the Orchard shielded engine (Halo2 prover, note
  trial-decryption, proof building, ST broadcast) under `operations/`. The
  main-process `ShieldedService` and `PlatformWorkerService` are facades that
  forward commands; `ShieldedService` also persists spent-note bookkeeping.
  `platform/types/messages.ts`.

**Layers (`src/main/src/`):** `api/` (one handler class per channel, each
`handle = async (event, ...args) => …`, constructed and registered in
`WalletBackend`) → `services/` (business logic only) → `database/` (Knex DAOs,
plain SQL). Alongside: `utils/` (pure, unit-tested helpers — a helper-only
module goes here, NOT in `services/`), `providers/`, `types/` (domain types with
`fromRow` factories).

`services/` has four groups: `wallet/` (the wallet record and the aggregate over
it), `core/` (L1), `platform/` (L2), `app/` (process-wide, wallet-agnostic).

- **`core/` imports nothing from `platform/`.** That direction is the hard rule;
  keep it.
- `WalletService` is the only service that reaches across L1 and L2 to *answer*
  something: `getWalletBalance` is the L1 address total plus the L2 identity
  credits, which no single layer can answer. Nothing else may copy that.
  (`FeeService` also spans `wallet/` and `platform/`, in both directions — it
  quotes fees for L2 operations. That is the one other crossing.)
- `WalletCredentialsService` owns the mnemonic and password and touches no
  chain, which is why it is not in `core/`. `IdentityService` reads identities;
  `IdentityRegistrationService` creates them by funding an asset lock.
  `PlatformAddressService` reads — which addresses exist and what they hold;
  `PlatformTransferService` is every way credits move on L2, the counterpart to
  `CoreTransactionService`.
- Three kinds share the `Service` suffix and fail differently: **process
  supervisors** (`WalletSyncService`, `PlatformWorkerService`) own a
  `UtilityProcess`; **job runners** (`AssetLockService`, `ShieldedService`) own
  keyed state that outlives the method that started it; the rest are
  request/response.
- `requireWallet`/`requireSelectedWallet` and `walletSeed` sit in `utils/` but
  take a `WalletDAO` — the one impure exception, so a guard or an unlock is
  written once instead of at every call site.

**Platform (L2) addresses are DIP-17** (`m/9'/coinType'/17'/account'/0'/index`,
account 0): rows in `platform_addresses` — not a count, never re-derived on
read, and NOT mirrors of L1 addresses. The account xpub is persisted in
`wallet.platform_xpub`; `platformAccountXpub()` in `utils/platformAddress.ts` is
the only place it is derived or backfilled, and every address comes from
`platformAddressDeriver(xpub, network)`, so no code path derives a platform
address from the seed. Signing keys still come from the seed, in the worker.

`wallet.platform_address_count` is legacy: it survives only so
`PlatformAddressService.seedLegacyWindow` can recover an address revealed by hand
before the table existed. Nothing writes it. `wallet.shielded_address_count` is
fully dead. Both can be dropped once every wallet has grown rows.

### Address windows (`utils/addressWindow.ts`)

All three key classes run the same gap walk. `runAddressWindow` knows nothing
about a key class and takes three collaborators:

- `AddressDeriver` — index → address + path (`coreAddressDeriver`,
  `platformAddressDeriver`, `shieldedAddressDeriver`)
- `UsageOracle` — `scan(gapLimit)` for a source that can walk the gap itself
  (returns `null` when it cannot, and the walk then widens round by round
  through `probe`)
- `AddressWindowStore` — what has been materialised, and how to reveal more

`planWindow` is the pure half and takes `known` (materialised) separately from
`usage` (just observed, and allowed to reach past it). Everything keys on the
**index**, never on the address string. Gap numbers live only in the three
policy constants in `constants/addresses.ts`.

Shielded is included because `shielded_notes.address` is our own diversified
address, which makes it a genuine per-index usage oracle (local rather than a
chain query, which `UsageOracle` does not care about). Note *discovery* is
separate and IVK-based — one viewing key finds every note whether or not its
diversifier was revealed; the window only governs which indexes are known and
flagged.

Shielded differs in two ways that are protocol, not design:

- **The deriver needs the seed.** ZIP-32 has no watch-only equivalent to an
  xpub, so the walk runs only inside an already-unlocked operation, on the seed
  that operation is holding. It must NOT be scheduled at boot or on a timer like
  core and platform, and **nothing may cache a seed, IVK or FVK** to make that
  possible. Its triggers are the end of `syncNotes` (after the notes are
  written — that is what the used flags are read from) and the spend paths,
  which already hold a seed.
- **There is no per-index derivation path.** A diversifier is not a path
  element, so `shielded_addresses` has no `derivation_path` column — it would
  hold `m/32'/coinType'/account'` on every row. The account is implied by the
  wallet and `address_index` carries the diversifier.

`ShieldedService.addAddress` refuses while the wallet is behind the pool (an
undecoded note may already own the diversifier it is about to hand out), and is
serialised per wallet rather than deduped, because two reveals must produce two
addresses.

**Revealing an address never needs the password on L1 or platform.** Both derive
from a persisted account xpub, so `addAddress`/`addPlatformAddress` take none
and the UI shows no form. Only shielded unlocks, for the reason above.

### p2p invariants (`src/main/p2p/`)

Four directories, split by what a thing *is*, not what it is about. `utils/` is
pure functions (byte order, x11, pow, header validation, locators) and `store/`
is chain.db plus the in-memory structures over it; neither knows a peer exists. `net/` (pools,
broadcast, peer selection) imports nothing. `sync/` is the only layer that
touches the others, and the only one holding timers and retry state. `index.ts`
is the IPC adapter and holds no logic.

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

### Preload (`src/preload/`)

`index.ts` exposes via `contextBridge`: `window.electron`
(`@electron-toolkit/preload`), `window.electronAPI` (from `definitions.ts`),
`window.darkMode`. `definitions.ts` holds typed `ipcRenderer.invoke(channel,
...)` wrappers. `index.d.ts` is the `Window.electronAPI` type and is
**hand-maintained, not generated — keep it in sync with `definitions.ts`**.

### Renderer (`src/renderer/src/`)

React SPA, React Router v7 (`HashRouter`), `@renderer` → `src/renderer/src/`.
UI is `dash-ui-kit` + Tailwind v4; extended kit wrappers/icons live in
`components/dash-ui-kit-enxtended/`.

- **Auth/app state lives in `contexts/AuthContext.tsx`** (`useAuth()`), NOT in
  `App.tsx`. It polls `getStatus` every 1s and exposes `status` (which holds
  `selectedWalletId`, `network`, `walletSync`), `isAuthenticated`,
  `switchWallet`. **Read `network`/`selectedWalletId` from `useAuth()` at the
  component that needs them — do not prop-drill them down the tree.**
- Routes are declared in `App.tsx`; sidebar nav items in
  `constants/navigation.ts`. A route with no matching `navGroups` entry is
  reachable only by URL.
- **CSP blocks external fetch.** `src/renderer/index.html` sets
  `default-src 'self'`, so the renderer CANNOT fetch external URLs or do `blob:`
  downloads. Any outbound HTTP or file write goes through the **main process**
  (`net.fetch` / `dialog`+`fs`) and an IPC channel — see `RatesService` and the
  `saveTextFile` handler.
- **External links:** `window.open(url, '_blank')` is intercepted by
  `setWindowOpenHandler` in `main/index.ts` → `shell.openExternal`. Use the
  `utils/explorer.ts` helpers for dashscan links.
- **Theme:** preference (`light`/`dark`/`system`) is persisted in localStorage
  and applied by `hooks/useThemeController.ts` (`ThemeController` mounted in
  `main.tsx`); `system` tracks the OS via `matchMedia`. Use
  `useThemePreference`/`setThemePreference`, not dash-ui-kit's `toggleTheme`.
- **Fiat:** `useFiat()` gives `format(duffs)`, `rateReady`, `currency`,
  `setCurrency`; live rates via the shared `useRates()` store. Amounts are in
  **duffs** (1 DASH = 1e8) — format with `utils/balance.ts`.

## Adding a new IPC endpoint (all 5 layers — miss one and it silently breaks)

1. Handler class in `src/main/src/api/…` with `handle = async (event, ...args)`.
2. Construct + register it in `src/main/src/WalletBackend.ts` (`initHandlers`
   for the `ipcMain.handle`, and `start()` to build its service).
3. Wrapper in `src/preload/definitions.ts`.
4. Type entry in `src/preload/index.d.ts` (`Window.electronAPI`).
5. Renderer wrapper in `src/renderer/src/api/index.ts` (`API` class) + any DTO
   in `src/renderer/src/api/types.ts`.

### `bigint` and `Uint8Array` cross as themselves

Both transports are **structured clone** — `ipcRenderer.invoke`/`ipcMain.handle`
and the utility-process ports (`postMessage` to `p2p`/`platform`) — and
structured clone carries `bigint` and `Uint8Array` natively.

So do NOT stringify credits/duffs or hex-encode bytes on the way out and parse
them back on the way in. Type the value `bigint` / `Uint8Array` through all five
layers. A `.toString()` on a credits field is a bug to remove, not a convention;
a `string` credits field in an older DTO is history to fix, not a pattern.

## Database & migrations

SQLite via Knex, at `~/.dash-desktop/storage.db`.

**A new wallet-scoped table must be added to `WALLET_SCOPED_TABLES`** in
`constants/database.ts`, or `deleteWallet` orphans its rows.
`tests/api/deleteWallet.test.ts` compares that list against the live schema and
fails when one is missing.

**Never build a path under the data folder by hand.** Everything on disk —
`storage.db`, `preferences.json`, `logs/`, `ChainStorage/` — goes through
`dataPath(...segments)` in `utils/dataPath.ts`, which roots an unpackaged run at
`~/.dash-desktop/dev/` and a packaged one at `~/.dash-desktop/`. The switch is
`import.meta.env.DEV`, so electron-vite folds it away at build time and the
shipped bundle has no dev branch. A hand-written
`path.join(os.homedir(), ...)` silently opts that file out of the split.

**Migrations are registered BY HAND, not auto-discovered.** Adding a file under
`src/main/migrations/` does nothing on its own — `src/main/src/utils/index.ts`
holds a hand-built `migrations` array that `migrateKnex()` feeds to Knex. You
MUST:
1. `import * as migrationNNNN from '../migrations/NNNN_name'`
2. append `{ name: 'NNNN_name.ts', migration: migrationNNNN }` to the array.

Forgetting this means the table is never created and DAO calls fail at runtime
(`no such table: ...`) even though everything typechecks and builds.

- **Number migrations against the latest on `master`**, not just local files —
  master and a feature branch both adding `0019_*` will collide.
- **Renumbering a migration that already ran on a dev DB** corrupts the
  `knex_migrations` bookkeeping (`directory is corrupt: NNNN_x.ts missing`). Fix
  by remapping the row name and applying any skipped columns by hand — back up
  `storage.db` first.

## Connection modes (p2p vs rpc) — important for any wallet data feature

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

### The lock pool runs in BOTH modes — `connectionType` does not gate it

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
  Chainlocks arrive the same way (`peerclsig` → `chainLocked` message) but have
  no waiter yet — they only feed `markChainlockedUpTo`.

### Incoming mempool txs (lock pool)

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

## House style

- **Default to no comment.** Write one only when the code cannot show the
  *why* — a protocol constraint, a third-party quirk, a review finding — and
  keep it to one or two lines. Never restate the signature, the types, or the
  control flow.
- **A comment is not where you explain your reasoning.** Alternatives you
  weighed, why this approach won, what the old code got wrong: response or
  commit message, never the source. No comment may reference the session that
  wrote it ("as discussed", "we decided", "per the review") or invent an
  example scenario to justify itself.
- Pure, branch-free logic (coin selection, formatting, validation, dedup, CSV)
  is extracted into `utils/` helpers and unit-tested in `tests/unit/`, not
  inlined into components or services.
- **No private method that only forwards.** A one-line `private foo(x) { return
  this.bar.foo(x) }` renames a call for no gain and hides where the work
  happens — inline it at the two or three call sites. Same for a private wrapper
  that only reshapes what it forwards (`{wallet, seed}` → `{network, seed}`):
  pass the original type through and read the field where it is used. A method
  earns its place by adding a branch, a default, a validation, or a name the
  call site cannot spell itself. This does **not** apply to the `api/` →
  `services/` → `database/` layering — a service method forwarding to a DAO is
  the boundary that keeps handlers off the DAOs — nor to a method implementing a
  declared interface.
- **Constants and types never live in the file that uses them**, however local
  they look — see "Where constants and types live".
- **Edit files directly; do not script bulk rewrites.**

### Scripted edits

A `perl -pi` / python pass over the tree is a last resort past ~15 files, not a
shortcut. It edits files nobody read, so its mistakes are invisible until the
typechecker happens to catch them — and it will not catch a wrong string that
still compiles. Real failures from such passes in this repo: a regex scoped to
`src/` rewrote the renderer's own types to point at main-process copies, caught
only because those bundles are separate tsconfig projects — the same mistake
inside one bundle would have compiled silently; a script re-run after a partial
failure overwrote hand-corrected files with its original guesses; a blanket rename double-prefixed lines an earlier pass had
already fixed. If you do script one:

1. **Scope it to a path** you have actually inspected. Never `src/` when you
   mean `src/main/src/`.
2. **Match exact multi-line strings copied out of the file**, not regexes over
   guessed content, and make a non-match a hard failure that reports the file.
3. **Make it idempotent, or do not re-run it.** A partial failure means fixing
   the remainder by hand.
4. **Diff before believing it.** A green typecheck is not evidence the edit was
   correct, only that it parses.

## Where constants and types live

Three bundles. A bundle's own domain types and constants are **private to it —
never import them across these boundaries.** Three things are shared on purpose
and do cross: `src/types/Network`, and the protocol numbers in
`src/constants/credits` (fees) and `src/constants/addresses` (`COIN_TYPE`,
`PLATFORM_ACCOUNT`, `SHIELDED_ACCOUNT`), both read by `platform/` — plus
`src/types/IdentityKeys`, which one signing-key operation reads. Nothing else
crosses.

| Bundle | Constants | Types |
|---|---|---|
| `src/main/src/**` | `src/main/src/constants/*.ts` | `src/main/src/types/*.ts` |
| `src/main/p2p/**` | `src/main/p2p/constants.ts` | `src/main/p2p/types/*.ts` |
| `src/main/platform/**` | `src/main/platform/constants.ts` | `src/main/platform/types/*.ts` |

`src/main/src/constants/` is split by domain (`addresses`, `app`, `chain`,
`credits`, `dashscan`, `database`) with **no barrel** — import the domain file
directly (`from '../constants/addresses'`), and a name may be exported by only
one of them. Type files are named for the domain, not the type (`AssetLock.ts`
holds `AssetLockFundingRow`, `AssetLockFunder`, `AcquireParams`…). A DAO's row
type, a service's params, a worker's event map all go here, not beside the class.

Four kinds of declaration legitimately stay put, because moving them would break
something rather than tidy it:

1. **Local aliases into a central type** — `type Payload =
   PlatformOperations['spend']['payload']`. The type is already central.
2. **Types inferred from a value in the same file** — `z.infer<typeof Schema>`,
   `ReturnType<...>` aliases.
3. **A type that is the file's whole purpose** — `providers/WalletProvider.ts`.
4. **Values computed at module load, not literals** — `POW_LIMIT_TARGET =
   bitsToTarget(POW_LIMIT_BITS)` in `p2p/utils/pow.ts` (moving it makes
   `constants.ts` ↔ `pow.ts` circular) and `DEDUCT_FROM_FIRST` in
   `platform/operations/address/signInputs.ts` (constructs a WASM object at
   import time; relocating it changes WASM init order in that bundle).
