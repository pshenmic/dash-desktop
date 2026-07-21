export const HOME_FOLDER_NAME = '.dash-platform-wallet'
export const HomeFolderName = '.dash-platform-wallet'
export const StorageFilename = 'storage.db'
export const ChainStorageFilename = 'ChainStorage'

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

// Currencies we request live DASH prices for — every selectable fiat needs a rate.
export const SUPPORTED_RATE_CURRENCIES = SUPPORTED_CURRENCIES

export const SEQUENCE_FINAL = 0xffffffff

export const ADDRESS_PREFIX: Record<'mainnet' | 'testnet', {p2pkh: number; p2sh: number}> = {
  mainnet: {p2pkh: 76, p2sh: 16},
  testnet: {p2pkh: 140, p2sh: 19},
}

// Background shielded-note download: the pool note count is compared with the
// local cache on this interval and any new ciphertexts are fetched (no
// password needed — decoding happens later, when the user unlocks).
// getShieldedEncryptedNotes requires startIndex to be chunk-aligned (a
// multiple of 2048); 8192 is the SDK max-per-query and a multiple of 2048.
export const SHIELDED_NOTES_CHECK_INTERVAL_MS = 15_000
export const SHIELDED_NOTES_CHUNK_ALIGNMENT = 2048
export const SHIELDED_NOTES_FETCH_BATCH = 8192

// Asset-lock proof acquisition during identity registration. The instant lock
// usually arrives within seconds; the chain-lock fallback can take a few
// minutes, so the overall timeout is generous.
export const IDENTITY_LOCK_POLL_INTERVAL_MS = 5_000
export const IDENTITY_LOCK_TIMEOUT_MS = 15 * 60 * 1000
