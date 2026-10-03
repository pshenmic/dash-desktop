# CLAUDE.md

Rules only. The per-area detail — why a plausible-looking change breaks
something — is in `docs/`: **read the file for an area before changing code in
it.**

| Area | File |
|---|---|
| Layers, services, preload, where declarations live | `docs/architecture.md` |
| SPV, peer pools, filters, difficulty | `docs/p2p.md` |
| Wallet data in `p2p` vs `rpc` mode, lock pool | `docs/wallet-data.md` |
| L1 / platform / shielded address derivation | `docs/addresses.md` |
| Renderer | `docs/renderer.md` |
| Migrations, on-disk paths | `docs/database.md` |

## Commands

`yarn` is the package manager (`yarn.lock` is the source of truth).
**Never run `pnpm install`** — it relocates the
yarn-installed `node_modules` and breaks the install; ignore any stray
`pnpm-lock.yaml`.

**The green gate.** A change is verified only when all five pass:

1. `npx tsc --noEmit -p tsconfig.node.json` (main + preload)
2. `npx tsc --noEmit -p tsconfig.web.json` (renderer)
3. `npx tsc --noEmit -p tests/tsconfig.json` — `tests/` is in neither app
   project, and vitest strips types rather than checking them; it is named
   `tsconfig.json` so editors resolve it too
4. `npx vitest run`
5. `npx electron-vite build` — a font `didn't resolve at build time` warning
   means the woff2 faces are missing from the bundle again

## House style

- **Default to no comment.** Write one only when the code cannot show the *why*
  — a protocol constraint, a third-party quirk, a review finding — and keep it
  to one or two lines. Never restate the signature, the types, or the control
  flow.
- **A comment is not where you explain your reasoning.** Alternatives you
  weighed, why this approach won, what the old code got wrong: response or
  commit message, never the source. No comment may reference the session that
  wrote it ("as discussed", "per the review") or invent an example scenario to
  justify itself.
- **Pure, branch-free logic** (coin selection, formatting, validation, dedup,
  CSV) is extracted into `utils/` and unit-tested in `tests/unit/`, not inlined
  into components or services.
- **No private method that only forwards**, and none that only reshapes what it
  forwards. A method earns its place by adding a branch, a default, a
  validation, or a name the call site cannot spell itself. The `api/` →
  `services/` → `database/` layering and a declared interface are exempt.
- **Constants and types never live in the file that uses them**, however local
  they look, and a bundle's own constants and types are private to it — the
  three bundles and their four exceptions are in `docs/architecture.md`.
- **Edit files directly; do not script bulk rewrites.** Past `perl -pi` passes
  here mis-scoped `src/` and rewrote the renderer's types to point at
  main-process copies, overwrote hand-corrected files on a re-run, and
  double-prefixed lines an earlier pass had fixed. Past ~15 files, if you must:
  scope it to a path you have inspected, match exact strings copied out of the
  file and make a non-match a hard failure, make it idempotent, and diff before
  believing it — a green typecheck only proves it parses.

## Adding a new IPC endpoint (all 5 layers — miss one and it silently breaks)

1. Handler class in `src/main/src/api/…` with `handle = async (event, ...args)`.
2. Construct + register it in `src/main/src/WalletBackend.ts` — `initHandlers`
   for the `ipcMain.handle`, `start()` to build its service.
3. Wrapper in `src/preload/definitions.ts`.
4. Type entry in `src/preload/index.d.ts` (`Window.electronAPI`), which is
   hand-maintained, not generated.
5. Renderer wrapper in `src/renderer/src/api/index.ts` (`API` class) + any DTO
   in `src/renderer/src/api/types.ts`.

**`bigint` and `Uint8Array` cross as themselves.** Both transports are structured
clone — `ipcRenderer.invoke`/`ipcMain.handle` and the utility-process ports — so
do NOT stringify credits/duffs or hex-encode bytes on the way out and parse them
back on the way in. Type the value through all five layers; a `.toString()` on a
credits field is a bug to remove, not a convention, and a `string` credits
field in an older DTO is history to fix, not a pattern.

## Database

- **A new wallet-scoped table must be added to `WALLET_SCOPED_TABLES`** in
  `constants/database.ts`, or `deleteWallet` orphans its rows.
- **Never build a path under the data folder by hand** — everything goes through
  `dataPath(...segments)` in `utils/dataPath.ts`, which splits an unpackaged run
  from a packaged one.
- **Migrations are registered BY HAND.** A file under `src/main/migrations/`
  does nothing until you import it in `src/main/src/utils/index.ts` and append
  `{name, migration}` to the `migrations` array. Miss it and DAO calls fail at
  runtime while everything typechecks and builds.
- **Number migrations against the latest on `master`**, not just local files.

→ `docs/database.md`

## Architecture

An Electron desktop wallet for Dash: electron-vite, React 19, TypeScript.
`src/main/src/` is layered `api/` → `services/` → `database/`, with pure helpers
in `utils/`, NOT `services/`. **`core/` imports nothing from `platform/`.**
`WalletService` is the only service that answers across L1 and L2 — nothing else
may copy that. `p2p/` and `platform/` each run in an Electron utility process; a
new one must be added to the `input` map in `electron.vite.config.ts`.

→ `docs/architecture.md`

### p2p (`src/main/p2p/`)

`utils/` pure functions, `store/` chain.db, `net/` pools and peer selection,
`sync/` the only layer touching the others and the only one holding timers. Do
not undo these:

- Nothing under `p2p/` opens SQLite; wallet state arrives in the `start` command.
- No hardcoded block hashes — anchors come from `cfcheckpt` or `GENESIS`.
- A cfcheckpt vector is length-checked before anything trusts it.
- A fetched block is checked against its merkle root before it is applied.
- Every header's `nBits` is checked against the retarget rule for its era, and
  three things in `utils/difficulty.ts` look like bugs and are not.
- `crypto-toothpick` stays in `external` in `electron.vite.config.ts`.

→ `docs/p2p.md`

### Wallet data (`p2p` vs `rpc`)

`WalletProviderFactory.forWallet()` resolves the `connectionType` preference
**per call, never cached on a service**. Write features against the
`WalletProvider` interface so they work in both modes; the source decides the
address set, not the caller. **The lock pool runs in both modes** — broadcast,
InstantSend and ChainLock watching, and incoming mempool txs are always up. A tx
must be armed with `watchForInstantLock` before its lock can arrive.

→ `docs/wallet-data.md`

### Addresses

All three key classes run one gap walk through `runAddressWindow`, keyed on the
**index**, never the address string; every gap number lives in
`constants/addresses.ts`. Platform addresses are DIP-17 rows derived from the
persisted account xpub, never from the seed. **Nothing may cache a seed, IVK or
FVK.**

→ `docs/addresses.md`

### Renderer (`src/renderer/src/`)

React Router v7 (`HashRouter`), `dash-ui-kit` + Tailwind v4. App state is
`useAuth()`, not `App.tsx`, read at the component that needs it rather than
prop-drilled. **CSP blocks external fetch** — outbound HTTP and file writes go
through the main process over IPC. Amounts are **duffs** (1 DASH = 1e8).

→ `docs/renderer.md`
