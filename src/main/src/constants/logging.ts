import {LogLevel} from '../types/Log'

// Rotate the current day's log file once it grows past this, and delete daily
// log files older than this many days on startup.
export const LOG_FILE_MAX_SIZE = 5 * 1024 * 1024
export const LOG_RETENTION_DAYS = 14
export const LOG_FILE_NAME_PATTERN = /^wallet-\d{4}-\d{2}-\d{2}(?:\.old)?\.log$/

// Ascending verbosity. A record is written when its index is <= the threshold's.
export const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug']

export const DEFAULT_LOG_LEVEL: LogLevel = 'info'

//
export const LOG_REPLACEMENT_PATTERNS: {pattern: RegExp; replacement: string}[] = [
  {pattern: /\b(?:[a-z]{3,8} ){11,23}[a-z]{3,8}\b/g, replacement: '[redacted:mnemonic]'},
  // key: value pairs, whatever the surrounding syntax (JSON, query string, SQL).
  // The lookahead leaves an already-redacted value alone.
  {
    pattern: /\b(mnemonic|passphrase|password|privateKey|private_key|secretKey|secret_key|seed)("?\s*[:=]\s*"?)(?!\[redacted)[^\s",;}\]]+/gi,
    replacement: '$1$2[redacted]',
  },
  // BIP-32 extended keys. The public half is redacted too: an account xpub
  // reveals every address the wallet will ever derive.
  {pattern: /\b(?:xprv|xpub|tprv|tpub)[1-9A-HJ-NP-Za-km-z]{50,}/g, replacement: '[redacted:extended-key]'},
  // WIF private keys. Dash shares its mainnet WIF leading character with P2PKH
  // addresses, so only the length tells them apart.
  {pattern: /\b[X7c9][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, replacement: '[redacted:private-key]'},
  // Platform and shielded addresses (bech32m, `dash1…` / `tdash1…`).
  {pattern: /\bt?dash1[02-9ac-hj-np-z]{20,}\b/g, replacement: '[redacted:address]'},
  // Core addresses: mainnet P2PKH/P2SH, testnet P2PKH/P2SH.
  {pattern: /\b[X7y89][1-9A-HJ-NP-Za-km-z]{33}\b/g, replacement: '[redacted:address]'},
]
