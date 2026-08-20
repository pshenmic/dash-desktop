import {KeyType, Purpose, SecurityLevel} from 'dash-platform-sdk/types.js'
import type {CoinSelectionParams} from './types/CoinSelection'

export const HomeFolderName = '.dash-desktop'
export const DevFolderName = 'dev'
export const StorageFilename = 'storage.db'
export const ChainStorageFilename = 'ChainStorage'
export const LogsFolderName = 'logs'

// Rotate the current day's log file once it grows past this, and delete daily
// log files older than this many days on startup.
export const LOG_FILE_MAX_SIZE = 5 * 1024 * 1024
export const LOG_RETENTION_DAYS = 14
export const LOG_FILE_NAME_PATTERN = /^wallet-\d{4}-\d{2}-\d{2}(?:\.old)?\.log$/

export const PreferencesFilename = 'preferences.json'

export const PBKDF2_KEY_LENGTH = 32
export const PBKDF2_DIGEST = 'sha512'
export const PBKDF2_SALT_LENGTH = 32
export const PBKDF2_TARGET_MS = 200

export const SUPPORTED_LANGUAGES = [
  "en",
]

export const SUPPORTED_CURRENCIES = [
  "usd",
  "eur",
  "btc",
  "rub"
]

export const SEQUENCE_FINAL = 0xffffffff

export const ADDRESS_PREFIX: Record<'mainnet' | 'testnet', {p2pkh: number; p2sh: number}> = {
  mainnet: {p2pkh: 76, p2sh: 16},
  testnet: {p2pkh: 140, p2sh: 19},
}

// BIP-44 coin type and the account level of every derivation path in the app.
// Defining these more than once forks the key tree on whichever copy is missed.
export const COIN_TYPE: Record<'mainnet' | 'testnet', number> = {mainnet: 5, testnet: 1}
export const PLATFORM_ACCOUNT = 0
export const SHIELDED_ACCOUNT = 0

// Background prefetch only keeps the ciphertext cache warm — detecting incoming
// notes needs trial-decryption, so a password. The batch size is fixed: the dpp
// proof verifier requires getShieldedEncryptedNotes startIndex to be a multiple
// of SHIELDED_MAX_NOTES_PER_QUERY.
export const SHIELDED_NOTES_CHECK_INTERVAL_MS = 30_000
export const SHIELDED_NOTES_FETCH_BATCH = 8192

// The instant lock usually arrives within seconds; the chain-lock fallback can
// take minutes, hence the generous timeout.
export const IDENTITY_LOCK_TIMEOUT_MS = 15 * 60 * 1000

// Backstop on the clsig wait in the chain-lock fallback. The lock pool wakes
// that loop, so this covers the two cases the pool cannot: no peers, and DAPI
// still reporting a transaction unlocked that our pool already saw locked —
// where waiting for the *next* clsig would cost a whole block interval.
export const CHAIN_LOCK_BACKSTOP_MS = 45 * 1000

// Sweeps expired entries out of the isdlock watch set. The rebroadcast loop
// does this too, but only runs in p2p mode, so without it an rpc-mode wallet
// keeps the worker fetching isdlocks nobody is waiting on.
export const LOCK_WATCH_SWEEP_INTERVAL_MS = 5 * 60 * 1000

// Outlives the asset-lock timeout above, so an arm never expires under a live
// waiter. Past it nothing is waiting and staying armed only makes the worker
// fetch isdlock objects it will discard.
export const LOCK_WATCH_TTL_MS = 20 * 60 * 1000

// BIP-44 gap limits and the ceiling on each discovery walk. Without a ceiling
// only the gap can stop the loop.
export const ADDRESS_LOOKAHEAD = 50

// Addresses derived at once when the gap runs short. Extending to exactly the
// gap limit re-exhausts on the very next used address, and a wallet with a run
// of them makes the cfilter scan rewind once per address.
export const ADDRESS_GAP_BATCH = 20

export const IDENTITY_LOOKAHEAD = 10
export const MAX_DISCOVERY_ROUNDS = 50
export const IDENTITY_SCAN_LIMIT = 100
export const PLATFORM_ADDRESS_LOOKAHEAD = 20
export const MAX_DISCOVERY_BATCHES = 50

// Consecutive unused indexes that end the top-up funding-key scan. A top-up's
// credit address receives the asset lock output, so the chain records every
// index this wallet ever used — which a local row count does not survive a
// restore to.
export const TOPUP_KEY_GAP_LIMIT = 5
export const TOPUP_KEY_SCAN_LIMIT = 200

// Bounds how far addAddress derives forward while skipping already-used
// diversified addresses.
export const NEW_ADDRESS_LOOKAHEAD_LIMIT = 2000

// How often the backend re-runs address discovery for the selected wallet.
export const DISCOVERY_INTERVAL_MS = 120_000

// The retained tail rides along on request and broadcast failures, so a worker
// crash carries its own cause instead of just "code=1".
export const CHILD_OUTPUT_TAIL_LIMIT = 8192

// Dash has no reject message, so absence of confirmation is never proof of
// failure — a tx is re-pushed until a block or lock settles it, never timed out.
export const REBROADCAST_INTERVAL_MS = 60_000

// applyBlock retry ladder. Failures here are almost always transient lock
// contention that busy_timeout already absorbs; what survives is a persistence
// gap.
export const PERSIST_ATTEMPTS = 3
export const PERSIST_RETRY_MS = 1_000

// SQLite bind-variable limit safety.
export const PAYLOAD_CHUNK_SIZE = 100
export const SELECT_CHUNK_SIZE = 500

// Transactions per prev-out resolution page, and how many of the DAPI reads
// behind a page run at once. A page is a step of the walk, not a cap on it.
export const PREVOUT_RESOLVE_BATCH = 50
export const PREVOUT_RESOLVE_CONCURRENCY = 5

// A coinbase input names no parent transaction.
export const COINBASE_PREV_TXID = '0'.repeat(64)

export const RATES_TTL_MS = 60_000
export const RATES_REQUEST_TIMEOUT_MS = 8_000

export const DASHSCAN_BASE_URLS: Record<'mainnet' | 'testnet', string> = {
  mainnet: 'https://dashscan.pshenmic.dev',
  testnet: 'https://testnet.dashscan.pshenmic.dev'
}
// The batch endpoints reject more than 100 addresses per call.
export const DASHSCAN_ADDRESS_CHUNK = 100

export const XPUB_PAGE_LIMIT = 100
// A cursor that does not advance would otherwise spin the page walk forever.
export const XPUB_MAX_PAGES = 200

// Chromium's own timeout runs into the tens of seconds — long enough that a
// stalled read reads as a hung wallet.
export const DASHSCAN_REQUEST_TIMEOUT_MS = 15_000
export const DASHSCAN_RETRY_DELAYS_MS = [300, 1_200]

export const DUFFS_PER_DASH = 100_000_000n

// base58check payload: 1 version byte + 20 hash bytes.
export const ADDRESS_DECODED_LENGTH = 21

export const HD_VERSIONS: Record<'mainnet' | 'testnet', {private: number; public: number}> = {
  mainnet: {private: 0x0488ade4, public: 0x0488b21e},
  testnet: {private: 0x04358394, public: 0x043587cf},
}

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
] as const

export const ALREADY_IN_CHAIN = 'state transition already in chain'

export const DEFAULT_SELECTION_PARAMS: CoinSelectionParams = {
  fee: 10_000n,
}

export const MIN_OUTPUT_CREDITS = 500_000n
export const TRANSFER_FEE_CREDITS = 6_500_000n
export const MIN_INPUT_CREDITS = 100_000n
export const MAX_ADDRESS_INPUTS = 16
export const MAX_RECIPIENTS = 128
export const WITHDRAWAL_FEE_CREDITS = 400_000_000n
export const CORE_FEE_PER_BYTE = 1
export const IDENTITY_CREDIT_TRANSFER_FEE_CREDITS = 1_000_000n

// The key set identityCreateFromAddresses builds; the fee scales with it, so
// the worker that creates the keys and main that reserves the fee read the
// same number.
export const IDENTITY_CREATE_KEY_COUNT = 4

// Mirrors compute_minimum_shielded_fee in rs-dpp (pshenmic/platform@1ba1ca5):
// consensus pins a pool-paid spend's value_balance to exactly this minimum, so
// note selection must reserve it. num_actions = max(spends, 2). Keep in sync
// with src/renderer/src/utils/shieldedFee.ts (pinned by tests/unit/shieldedFee.test.ts).
export const SHIELDED_PROOF_VERIFICATION_FEE_CREDITS = 100_000_000n
export const SHIELDED_PER_ACTION_PROCESSING_FEE_CREDITS = 22_000_000n
export const SHIELDED_STORAGE_BYTES_PER_ACTION = 344n
export const SHIELDED_UNSHIELD_ADDRESS_STORAGE_BYTES = 222n
export const SHIELDED_WITHDRAWAL_DOCUMENT_STORAGE_BYTES = 4_100n
export const SHIELDED_STORAGE_CREDIT_PER_BYTE = 27_400n
export const MIN_BUNDLE_ACTIONS = 2

export const ASSET_LOCK_PAYLOAD_VERSION = 1
export const ASSET_LOCK_CREDIT_OUTPUT_INDEX = 0
export const ASSET_LOCK_DISMISSED_ERROR = 'Pending funding dismissed by user'
export const CREDITS_PER_DUFF = 1_000n
export const SHIELD_FUNDING_FEE_RESERVE_CREDITS = 300_000_000n

// Protocol limits IdentityCreateTransition to 6 public keys. AUTH MEDIUM is
// dropped (added later via IdentityUpdateTransition if needed); MASTER /
// CRITICAL / HIGH plus ENCRYPTION / DECRYPTION / TRANSFER cover the common path.
export const IDENTITY_KEY_DEFINITIONS = [
  {id: 0, purpose: Purpose.AUTHENTICATION, securityLevel: SecurityLevel.MASTER, keyType: KeyType.ECDSA_SECP256K1},
  {id: 1, purpose: Purpose.AUTHENTICATION, securityLevel: SecurityLevel.CRITICAL, keyType: KeyType.ECDSA_SECP256K1},
  {id: 2, purpose: Purpose.AUTHENTICATION, securityLevel: SecurityLevel.HIGH, keyType: KeyType.ECDSA_SECP256K1},
  {id: 3, purpose: Purpose.ENCRYPTION, securityLevel: SecurityLevel.MEDIUM, keyType: KeyType.ECDSA_SECP256K1},
  {id: 4, purpose: Purpose.DECRYPTION, securityLevel: SecurityLevel.MEDIUM, keyType: KeyType.ECDSA_SECP256K1},
  {id: 5, purpose: Purpose.TRANSFER, securityLevel: SecurityLevel.CRITICAL, keyType: KeyType.ECDSA_SECP256K1},
] as const
