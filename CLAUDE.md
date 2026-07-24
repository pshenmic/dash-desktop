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
3. `npx vitest run tests/unit` passes
4. `npx electron-vite build` succeeds

> `electron-vite build` emits many `@fontsource/manrope ... didn't resolve at
> build time` warnings — these are pre-existing and harmless. Only non-font
> errors matter.

> **Stale `tests/api/`:** the committed `tests/api/*.test.ts` files are
> outdated and do NOT compile/pass (they reference deleted modules and an old
> `WalletService` constructor). Run `vitest run tests/unit`, not the whole
> suite, until they are fixed or removed. New tests go in `tests/unit/`.

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
  utility process** (forked from `WalletSyncService`). It owns the peer pool,
  header/cfilter sync, and transaction broadcast. Communicates with the main
  process by message passing (`p2p/types/messages.ts`).
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

**IPC value boundary:** `bigint` does not round-trip reliably across the
structured-clone boundary in every path. Amounts crossing IPC are passed as
**strings** and converted with `BigInt(...)` inside the handler (see
`sendTransaction`). Mirror that for new money-carrying channels.

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

- **`rpc`** (default) → `InsightWalletProvider`: hits the Insight REST API.
  Implements `getUTXOs` + `broadcastTx` (POST `/tx/send`).
- **`p2p`** → `P2PWalletProvider`: reads the local SPV SQLite store; broadcast
  routes through the p2p utility process (`WalletSyncService.broadcastTransaction`).
  **Requires `startWalletSync` to be running** (broadcast needs an open peer
  pool) and throws `Unimplemented` for `getBlockByHash`.

Write wallet features against the `WalletProvider` interface so they work in
both modes. Note `getTransactions` fetches per-address and is de-duped by txid
in `WalletService` (one tx touches several owned addresses: spent inputs +
change) — see `dedupeTransactions`.

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

- **No code comments unless they explain non-obvious *why*.** This codebase
  keeps comments sparse; do not add narrating comments.
- Pure, branch-free logic (coin selection, formatting, validation, dedup, CSV)
  is extracted into `utils/` helpers and unit-tested in `tests/unit/`. Prefer
  that over inlining testable logic into components or services.
