export const HomeFolderName = '.dash-desktop'
export const DevFolderName = 'dev'
export const StorageFilename = 'storage.db'
export const ChainStorageFilename = 'ChainStorage'
export const LogsFolderName = 'logs'
export const PreferencesFilename = 'preferences.json'
export const WindowStateFilename = 'window-state.json'

export const WINDOW_WORKAREA_RATIO = 0.85
export const WINDOW_MAX_DEFAULT_WIDTH = 1600
export const WINDOW_MAX_DEFAULT_HEIGHT = 1000
export const WINDOW_MIN_WIDTH = 1200
export const WINDOW_MIN_HEIGHT = 700
export const WINDOW_MIN_VISIBLE_PX = 100

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
