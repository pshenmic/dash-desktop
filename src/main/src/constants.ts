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
