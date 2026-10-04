# Database and on-disk paths

SQLite via Knex, at `~/.dash-desktop/storage.db`.

## Wallet-scoped tables

A new wallet-scoped table must be added to `WALLET_SCOPED_TABLES` in
`constants/database.ts`, or `deleteWallet` orphans its rows.
`tests/api/deleteWallet.test.ts` compares that list against the live schema and
fails when one is missing.

## Paths

Everything on disk — `storage.db`, `preferences.json`, `logs/`, `ChainStorage/`
— goes through `dataPath(...segments)` in `utils/dataPath.ts`, which roots an
unpackaged run at `~/.dash-desktop/dev/` and a packaged one at
`~/.dash-desktop/`. The switch is `import.meta.env.DEV`, so electron-vite folds
it away at build time and the shipped bundle has no dev branch. A hand-written
`path.join(os.homedir(), ...)` silently opts that file out of the split.

## Migrations are registered by hand, not auto-discovered

Adding a file under `src/main/migrations/` does nothing on its own —
`src/main/src/utils/index.ts` holds a hand-built `migrations` array that
`migrateKnex()` feeds to Knex. You MUST:

1. `import * as migrationNNNN from '../../migrations/NNNN_name'`
2. append `{ name: 'NNNN_name.ts', migration: migrationNNNN }` to the array.

Forgetting this means the table is never created and DAO calls fail at runtime
(`no such table: ...`) even though everything typechecks and builds.

- **Number migrations against the latest on `master`**, not just local files —
  master and a feature branch both adding `0019_*` will collide.
- **Renumbering a migration that already ran on a dev DB** corrupts the
  `knex_migrations` bookkeeping (`directory is corrupt: NNNN_x.ts missing`). Fix
  by remapping the row name and applying any skipped columns by hand — back up
  `storage.db` first.
