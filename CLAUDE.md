# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # Start in development mode (electron-vite dev)
yarn build        # Typecheck + build (outputs to out/)
yarn typecheck    # tsc --noEmit on tsconfig.node.json AND tsconfig.web.json
yarn start        # Preview built app
yarn test         # vitest run
yarn test:watch   # vitest watch

yarn build:mac    # Build macOS distributable
yarn build:win    # Build Windows distributable
yarn build:linux  # Build Linux distributable
```

**Package manager: yarn** (`yarn.lock` is the source of truth). A stray
`pnpm-lock.yaml` may appear in the tree — ignore it; do NOT run `pnpm install`,
it relocates the yarn-installed `node_modules` and breaks the install. Use
`yarn install`.

### Verifying a change (the green gate)

There is no single "is it good" command. A change is verified only when ALL of:

1. `npx tsc --noEmit -p tsconfig.node.json` (main + preload) passes
2. `npx tsc --noEmit -p tsconfig.web.json` (renderer) passes
3. `npx tsc --noEmit -p tests/tsconfig.json` (`tests/`) passes
4. `npx vitest run` passes
5. `npx electron-vite build` succeeds

> `electron-vite build` emits many `@fontsource/manrope ... didn't resolve at
> build time` warnings — these are pre-existing and harmless. Only non-font
> errors matter.

**Step 3 exists because `tests/` is in neither of the two app projects.** A
test that passes at runtime can still be type-broken — a string literal where a
string enum is required, an object literal missing a field the interface gained
— and vitest will not notice, because it strips types rather than checking
them. `tests/tsconfig.json` covers `tests/` plus both `src` trees. Being a
`tsconfig.json` (not a differently-named config) also means editors resolve it
for test files, so the IDE stops falling back to an ES5 target and reporting
phantom "BigInt literals are not available" errors.


## Architecture

An **Electron desktop wallet** for Dash, built with electron-vite, React 19,
and TypeScript. Three processes:

### Main process (`src/main/`)

- Entry point: `src/main/index.ts` — creates the `BrowserWindow`, registers
  `dark-mode:*` and `saveTextFile` IPC handlers, then calls
  `WalletBackend.start()`.
- `src/main/src/WalletBackend.ts` — the real backend. `start()` runs
  migrations, constructs DAOs/services, and **registers every wallet IPC
  handler directly** via `ipcMain.handle(...)` in `initHandlers()`. There is
  **no** `routes.ts`, `handlers.ts`, or `backend.ts` (older docs lied). The
  `src/main/src/api/WalletAPI.ts` file is dead/unused — do not add to it.
- `src/main/p2p/` — the SPV P2P subsystem runs in a separate **Electron
  utility process** (forked from `WalletSyncService`). It owns two peer pools —
  a lock pool that is up in **both** connection modes and a bulk pool that is
  not, see "Connection modes" below — plus header/cfilter sync and transaction
  broadcast. Communicates with the main process by message passing
  (`p2p/types/messages.ts`).
- `src/main/shielded/` — the shielded (Orchard) subsystem runs in its own
  **Electron utility process** (forked from `ShieldedService`): Halo2 prover,
  note trial-decryption, proof building, ST broadcast. The main-process
  `ShieldedService` is a facade that forwards commands and persists spent-note
  bookkeeping (`shielded/types/messages.ts`). New utility-process entries must
  be added to the `input` map in `electron.vite.config.ts`.

**Layer structure (`src/main/src/`):**
- `api/` — one IPC handler class per channel, each with
  `handle = async (event, ...args) => ...`. Construct in `WalletBackend` and
  register with `ipcMain.handle('channelName', new Handler(deps).handle)`.
- `database/` — Knex DAO classes (`WalletDAO`, `AddressDAO`, `TransactionDAO`,
  `IdentityDAO`, `ContactDAO`). Plain SQL against SQLite.
- `services/` — business logic only (`WalletService`,
  `PlatformAddressService`, `ShieldedService`, `WalletSyncService`,
  `RatesService`, `ContactService`, `ApplicationService`, `AssetLockService`,
  `CoreTransactionService`).
- `utils/` — pure, unit-tested helpers (`coinSelection`, `dedupeTransactions`,
  `platformTransfer`, `shieldedNoteSelection`, `coreScript`, `identityKeys`,
  `assetLockTx`) + `utils/index.ts` (crypto/knex/migrations). Helper-only
  modules go here, NOT in `services/`.
- `providers/` — see "Connection modes" below.
- `types/` — domain types with `fromRow` factories.

**Platform (L2) addresses are DIP-17** (`m/9'/coinType'/17'/account'/0'/index`,
account 0, lookahead 20). The account-level xpub is persisted in
`wallet.platform_xpub` (backfilled on login/create in `WalletService`);
`PlatformAddressService` derives the address list from the xpub without a
password and derives per-index keys from the seed for signing. Platform
addresses are NOT mirrors of L1 addresses anymore.

### Preload (`src/preload/`)

- `index.ts` — exposes via `contextBridge`: `window.electron`
  (`@electron-toolkit/preload`), `window.electronAPI` (app IPC, from
  `definitions.ts`), `window.darkMode` (theme bridge).
- `definitions.ts` — typed `ipcRenderer.invoke(channel, ...)` wrappers.
- `index.d.ts` — the `Window.electronAPI` type. **Keep in sync with
  `definitions.ts`** — it is hand-maintained, not generated.

### Renderer (`src/renderer/src/`)

React SPA, React Router v7 (`HashRouter`). `@renderer` → `src/renderer/src/`.
UI: `dash-ui-kit` + Tailwind v4. Extended kit wrappers/icons live in
`components/dash-ui-kit-enxtended/`.

- **Auth/app state lives in `contexts/AuthContext.tsx`** (`useAuth()`), NOT in
  `App.tsx`. It polls `getStatus` every 1s and exposes `status` (which holds
  `selectedWalletId`, `network`, `walletSync`), `isAuthenticated`,
  `switchWallet`, etc. **Read `network`/`selectedWalletId` from `useAuth()` at
  the component that needs them — do not prop-drill them down the tree.**
- Routes (`App.tsx`): authenticated `/` Transactions, `/send`, `/receive`,
  `/addresses`, `/identities`, `/settings`; unauthenticated `/` Login and
  `/create-wallet`. Sidebar nav items are in `constants/navigation.ts` — a
  route without a matching `navGroups` entry is reachable only by URL.

## Adding a new IPC endpoint (all 5 layers — miss one and it silently breaks)

1. Handler class in `src/main/src/api/...` with `handle = async (event, ...args)`.
2. Construct + register it in `src/main/src/WalletBackend.ts` (`initHandlers`
   for the `ipcMain.handle`, and `start()` to build its service).
3. Wrapper in `src/preload/definitions.ts`.
4. Type entry in `src/preload/index.d.ts` (`Window.electronAPI`).
5. Renderer wrapper in `src/renderer/src/api/index.ts` (`API` class) + any
   DTO in `src/renderer/src/api/types.ts`.

### `bigint` and `Uint8Array` cross as themselves

Both transports are **structured clone**: `ipcRenderer.invoke`/`ipcMain.handle`
and the utility-process ports (`postMessage` to `p2p`/`platform`). Structured
clone carries `bigint` and `Uint8Array` natively.

So do NOT stringify credits/duffs or hex-encode bytes on the way out and parse
them back on the way in. Pass the value as is, and type it `bigint` /
`Uint8Array` all the way through — handler, `definitions.ts`, `index.d.ts`, and
the renderer DTO. A `.toString()` on a credits field is a bug to remove, not a
convention.

Older DTOs still carry `string` credits (`PlatformAddressEntry.balanceCredits`,
`ShieldedPoolInfo`, `PlatformSendResult`). That is history, not a pattern to
copy — new endpoints use the real types.

## Database & migrations

SQLite via Knex, at `~/.dash-desktop/storage.db`. Tables: `wallet`,
`addresses`, `identities`, `transactions` (+ `transaction_inputs/_outputs`,
`wallet_sync_state`), `contacts`.

**Migrations are registered BY HAND, not auto-discovered.** Adding a file under
`src/main/migrations/` does nothing on its own — `migrateKnex()` in
`src/main/src/utils.ts` builds an inline `migrations` array. You MUST:
1. `import * as migrationNNNN from '../migrations/NNNN_name'`
2. append `{ name: 'NNNN_name.ts', migration: migrationNNNN }` to the array.

Forgetting this means the table is never created and DAO calls fail at runtime
(`no such table: ...`) even though everything typechecks and builds.

- **Number migrations against the latest on `master`**, not just local files.
  master and a feature branch both adding `0004_*` will collide; renumber yours
  to the next free index.
- **Renumbering a migration that already ran on a dev DB** corrupts the
  `knex_migrations` bookkeeping (`directory is corrupt: NNNN_x.ts missing`).
  Fix by remapping the row name in `knex_migrations` and applying any skipped
  migration's columns by hand — back up `storage.db` first.

## Connection modes (p2p vs rpc) — important for any wallet data feature

`WalletService.getProvider()` returns one of two `WalletProvider`
implementations based on the `connectionType` preference:

- **`rpc`** (default) → `DashscanWalletProvider`: hits the Dashscan REST API
  (`DASHSCAN_BASE_URLS`). Batch endpoints (`/addresses/info`,
  `/addresses/utxo`) take 100 addresses per call; `/address/:a/transactions` is
  paginated and the provider walks every page. Wire shapes live in
  `types/Dashscan.ts`, the mapping to our `Transaction` in
  `utils/dashscanTransactions.ts`.
- **`p2p`** → `P2PWalletProvider`: reads the local SPV SQLite store; broadcast
  routes through the p2p utility process (`WalletSyncService.broadcastTransaction`).

Neither provider broadcasts — both modes send over the p2p lock pool, see below.
`vin[].value` / `vout[].value` are **DASH decimal strings** in both providers;
duffs live in `inAmount` / `outAmount` / `transferAmount` as `bigint`.

Write wallet features against the `WalletProvider` interface so they work in
both modes. Note `getTransactions` fetches per-address and is de-duped by txid
in `WalletService` (one tx touches several owned addresses: spent inputs +
change) — see `dedupeTransactions`.

### The lock pool runs in BOTH modes — `connectionType` does not gate it

The p2p utility process owns **two pools**, and only one of them is a mode:

| Pool | Peers | Carries | Lifetime |
|---|---|---|---|
| `lockPool` | relay=**true**, network-scoped | broadcast, InstantSend (`isdlock`) and ChainLock (`clsig`) watching | **always up**, both modes |
| `bulkPool` | relay=false, dnsSeed=false | headers, cfilters, blocks | `p2p` mode only, via `startWalletSync` |

`startLockListen(network)` is called from `WalletBackend` at boot and
`WalletService` on wallet select, with **no `connectionType` check**. So the
child process exists and hears locks even in the default `rpc` mode.

Two consequences that are easy to get wrong:

- **Locally-signed transactions never go out over Dashscan.** `getProvider()`
  covers *reads* and third-party broadcast; asset locks bypass it —
  `WalletService.buildAndBroadcastAssetLock` calls
  `walletSyncService.broadcastTransaction` directly, in both modes, because the
  lock pool is the only pool that can hear the resulting `isdlock`.
- **A tx must be armed before its lock can arrive.** An ISDLOCK inv requires an
  explicit `getdata`, so `broadcastTransaction` calls `watchForInstantLock(txid)`
  before sending. A tx nobody armed gets its lock seen and dropped.

Corollary: **never reach for `coreSDK.subscribeToTransactions` for a transaction
this wallet broadcast.** DAPI is a different network path and does not deliver
that lock in either mode. Use `WalletService.waitForInstantLock(txid, timeoutMs)`.
Chainlocks arrive the same way (`peerclsig` → `chainLocked` message) but have no
waiter yet — they only feed `markChainlockedUpTo`.

## Renderer conventions worth knowing

- **CSP blocks external fetch.** `src/renderer/index.html` sets
  `default-src 'self'`. The renderer CANNOT fetch external URLs or do `blob:`
  downloads. Any outbound HTTP or file write must go through the **main
  process** (`net.fetch` / `dialog`+`fs`) and an IPC channel — see
  `RatesService` (CoinGecko) and the `saveTextFile` handler.
- **External links:** `window.open(url, '_blank')` is intercepted by
  `setWindowOpenHandler` in `main/index.ts` → `shell.openExternal` (system
  browser). Use the `utils/explorer.ts` helpers for dashscan links.
- **Theme:** preference (`light`/`dark`/`system`) is persisted in localStorage
  and applied by `hooks/useThemeController.ts` (`ThemeController` mounted in
  `main.tsx`); `system` tracks the OS via `matchMedia`. Use
  `useThemePreference`/`setThemePreference`, not the dash-ui-kit `toggleTheme`.
- **Fiat:** `useFiat()` gives `format(duffs)`, `rateReady`, `currency`,
  `setCurrency`; live rates via the shared `useRates()` store. Amounts are in
  **duffs** (1 DASH = 1e8 duffs) — format with `utils/balance.ts`
  (`davToDash`/`dashToDuffs`).

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
  is extracted into `utils/` helpers and unit-tested in `tests/unit/`. Prefer
  that over inlining testable logic into components or services.
- **No private method that only forwards.** A one-line `private foo(x) { return
  this.bar.foo(x) }` renames a call for no gain and hides where the work
  happens — inline it at the two or three call sites instead. Same for a
  private wrapper that only reshapes what it forwards (`{wallet, seed}` →
  `{network, seed}`): pass the original type through and read the field where
  it is used. A method earns its place by adding a branch, a default, a
  validation, or a name the call site cannot spell itself. This does **not**
  apply to the `api/` → `services/` → `database/` layering: a service method
  that forwards to a DAO is the boundary that keeps handlers off the DAOs, and
  a method implementing a declared interface stays even when its body is one
  line.
- **Constants and types never live in the file that uses them.** Every
  module-level `const` goes in its bundle's `constants.ts`; every `interface` /
  `type` goes in its bundle's `types/` directory, one file per domain. Do not
  declare either next to the code that consumes it, however local it looks.
- **Edit files directly; do not script bulk rewrites.** Reach for a script only
  when the same mechanical change has to land in more than ~15 files, and then
  think twice about what it will actually touch before running it — see below.

## Scripted edits

A `perl -pi` / python pass over the tree is a last resort, not a shortcut. It
edits files nobody read, so its mistakes are invisible until the typechecker
happens to catch them — and it will not catch a wrong string that still
compiles. Real failures from one such pass in this repo:

- A regex that moved imports rewrote **`src/renderer`** too, repointing the
  renderer's own `ShieldedSyncPhase` / `ShieldedProverState` at the
  main-process copies. `tsconfig.web.json` rejected it, but only because those
  bundles are separate projects — a same-bundle version of that mistake would
  have compiled silently.
- A script that both wrote new files and stripped old ones was re-run after a
  partial failure, **overwriting hand-corrected files with the original
  guesses**.
- Blanket `s/OLD/NEW/g` renames double-prefixed the lines a previous pass had
  already fixed (`INSIGHT_INSIGHT_BASE_URLS`).

If you do script one:

1. **Scope it to a path** you have actually inspected. Never `src/` when you
   mean `src/main/src/`.
2. **Match exact multi-line strings copied out of the file**, not regexes over
   guessed content, and make a non-match a hard failure that reports the file.
3. **Make it idempotent, or do not re-run it.** A partial failure means fixing
   the remainder by hand.
4. **Diff before believing it.** A green typecheck is not evidence the edit was
   correct, only that it parses.

## Where constants and types live

Three bundles, each self-contained — **never import constants or types across
these boundaries** except the existing `platform/` → `src/constants` fee
constants, which are shared protocol numbers:

| Bundle | Constants | Types |
|---|---|---|
| `src/main/src/**` | `src/main/src/constants.ts` | `src/main/src/types/*.ts` |
| `src/main/p2p/**` | `src/main/p2p/constants.ts` | `src/main/p2p/types/*.ts` |
| `src/main/platform/**` | `src/main/platform/constants.ts` | `src/main/platform/types/*.ts` |

Type files are named for the domain, not the type (`AssetLock.ts` holds
`AssetLockFundingRow`, `AssetLockFunder`, `AcquireParams`…). A DAO's row type,
a service's params, a worker's event map — all of them go here, not beside the
class.

Four kinds of declaration legitimately stay put, because moving them would
break something rather than tidy it:

1. **Local aliases into a central type** — `type Payload =
   PlatformOperations['spend']['payload']` in each operation file. The type is
   already central; the alias is just shorthand.
2. **Types inferred from a value in the same file** — `z.infer<typeof Schema>`
   in `preferences/`, `ReturnType<...>` aliases.
3. **A type that is the file's whole purpose** — `providers/WalletProvider.ts`.
4. **Values computed at module load, not literals** — `POW_LIMIT_TARGET =
   bitsToTarget(POW_LIMIT_BITS)` in `p2p/pow.ts` (moving it makes
   `constants.ts` ↔ `pow.ts` circular) and `DEDUCT_FROM_FIRST` in
   `platform/operations/address/signInputs.ts` (constructs a WASM object at
   import time; relocating it changes WASM init order in that bundle).
