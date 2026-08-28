// Every table keyed by wallet_id, minus `wallet` itself, which deleteWallet
// removes last so the rows referencing it go first. Deleting a wallet has to
// clear all of them: what survived otherwise was the whole L1 history plus the
// decrypted amount and address of every shielded note the wallet owned.
// `contacts` and `shielded_pool_notes` are network-scoped and stay.
export const WALLET_SCOPED_TABLES = [
  'identities',
  'addresses',
  'transactions',
  'transaction_outputs',
  'transaction_inputs',
  'wallet_sync_state',
  'asset_lock_fundings',
  'shielded_addresses',
  'shielded_notes',
  'platform_addresses',
] as const

// SQLite bind-variable limit safety.
export const PAYLOAD_CHUNK_SIZE = 100
export const SELECT_CHUNK_SIZE = 500

// applyBlock retry ladder. Failures here are almost always transient lock
// contention that busy_timeout already absorbs; what survives is a persistence
// gap.
export const PERSIST_ATTEMPTS = 3
export const PERSIST_RETRY_MS = 1_000
