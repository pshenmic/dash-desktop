export const HomeFolderName = '.dash-desktop'
export const DevFolderName = 'dev'
export const StorageFilename = 'storage.db'
export const ChainStorageFilename = 'ChainStorage'
export const LogsFolderName = 'logs'
export const PreferencesFilename = 'preferences.json'

// Rotate the current day's log file once it grows past this, and delete daily
// log files older than this many days on startup.
export const LOG_FILE_MAX_SIZE = 5 * 1024 * 1024
export const LOG_RETENTION_DAYS = 14
export const LOG_FILE_NAME_PATTERN = /^wallet-\d{4}-\d{2}-\d{2}(?:\.old)?\.log$/

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

export const RATES_TTL_MS = 60_000
export const RATES_REQUEST_TIMEOUT_MS = 8_000

// The retained tail rides along on request and broadcast failures, so a worker
// crash carries its own cause instead of just "code=1".
export const CHILD_OUTPUT_TAIL_LIMIT = 8192
