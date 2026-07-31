export const HomeFolderName = '.dash-desktop'
export const StorageFilename = 'storage.db'
export const ChainStorageFilename = 'ChainStorage'
export const LogsFolderName = 'logs'

// Rotate the current day's log file once it grows past this, and delete daily
// log files older than this many days on startup.
export const LOG_FILE_MAX_SIZE = 5 * 1024 * 1024
export const LOG_RETENTION_DAYS = 14

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

// Background pool prefetch. It cannot detect incoming notes on its own —
// that needs trial-decryption, so a password — so this only keeps the
// ciphertext cache warm for a wallet that has already synced once.
// The dpp proof verifier requires getShieldedEncryptedNotes startIndex to be
// a multiple of SHIELDED_MAX_NOTES_PER_QUERY (8192), so fetches always start
// at a multiple of the batch size and advance by full batches.
export const SHIELDED_NOTES_CHECK_INTERVAL_MS = 30_000
export const SHIELDED_NOTES_FETCH_BATCH = 8192

// Asset-lock proof acquisition during identity registration. The instant lock
// usually arrives within seconds; the chain-lock fallback can take a few
// minutes, so the overall timeout is generous.
export const IDENTITY_LOCK_POLL_INTERVAL_MS = 5_000
export const IDENTITY_LOCK_TIMEOUT_MS = 15 * 60 * 1000

// How long a txid stays armed for isdlock capture. Outlives the asset-lock
// timeout above so the arm never expires under a live waiter; past it nothing
// is waiting, and staying armed only makes the worker fetch isdlock objects
// it will discard.
export const LOCK_WATCH_TTL_MS = 20 * 60 * 1000
