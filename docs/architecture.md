# Main process, layers, and where declarations live

## Main process (`src/main/`)

`src/main/index.ts` creates the `BrowserWindow`, registers the `dark-mode:*` and
`saveTextFile` handlers, then calls `WalletBackend.start()`.
`src/main/src/WalletBackend.ts` is the real backend: `start()` runs migrations,
constructs DAOs/services, and **registers every wallet IPC handler directly**
via `ipcMain.handle(...)` in `initHandlers()`. There is no `routes.ts`,
`handlers.ts`, or `backend.ts`.

Two subsystems run in their own **Electron utility process**, talking to main by
message passing. A new utility-process entry must be added to the `input` map in
`electron.vite.config.ts`.

- `src/main/p2p/` — SPV: two peer pools, header/cfilter sync, broadcast.
  `p2p/types/messages.ts`.
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

## Preload (`src/preload/`)

`index.ts` exposes via `contextBridge`: `window.electron`
(`@electron-toolkit/preload`), `window.electronAPI` (from `definitions.ts`),
`window.darkMode`. `definitions.ts` holds typed `ipcRenderer.invoke(channel,
...)` wrappers. `index.d.ts` is the `Window.electronAPI` type and is
**hand-maintained, not generated — keep it in sync with `definitions.ts`**.

## Where constants and types live

A bundle's constants and types are **private to it** — never import them across
these boundaries:

| Bundle | Constants | Types |
|---|---|---|
| `src/main/src/**` | `src/main/src/constants/*.ts` | `src/main/src/types/*.ts` |
| `src/main/p2p/**` | `src/main/p2p/constants.ts` | `src/main/p2p/types/*.ts` |
| `src/main/platform/**` | `src/main/platform/constants.ts` | `src/main/platform/types/*.ts` |

`src/main/src/constants/` is split by domain (`addresses`, `app`, `chain`,
`credits`, `dashscan`, `database`) with **no barrel** — import the domain file
directly (`from '../constants/addresses'`), and a name may be exported by only
one of them. Type files are named for the domain, not the type: `AssetLock.ts`
holds `AssetLockFundingRow`, `AssetLockFunder`, `AcquireParams`… A DAO's row
type, a service's params, a worker's event map all go there, not beside the
class.

### What crosses the bundle boundary on purpose

Three things are shared deliberately: `src/types/Network`, and the protocol
numbers in `src/constants/credits` (fees) and `src/constants/addresses`
(`COIN_TYPE`, `PLATFORM_ACCOUNT`, `SHIELDED_ACCOUNT`), both read by `platform/`,
plus `src/types/IdentityKeys` in one signing-key operation. Separately,
`platform/` reaches into a few `src/utils/` helpers — `coreScript`,
`identityKeys`, `sdkErrors`, `shieldedNoteSelection`. That is pure shared logic,
not the rule's subject, but do not read the rule as "nothing crosses".

### Declarations that legitimately stay in the file that uses them

Moving these would break something rather than tidy it:

1. **Local aliases into a central type** — `type Payload =
   PlatformOperations['spend']['payload']`. The type is already central.
2. **Types inferred from a value in the same file** — `z.infer<typeof Schema>`,
   `ReturnType<...>` aliases.
3. **A type that is the file's whole purpose** — `providers/WalletProvider.ts`.
4. **Values computed at module load, not literals** — `DEDUCT_FROM_FIRST` in
   `platform/operations/address/signInputs.ts` (constructs a WASM object at
   import time; relocating it changes WASM init order in that bundle).
