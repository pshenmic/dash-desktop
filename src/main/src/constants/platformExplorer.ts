import {PoolSpendOperation} from '../../platform/types/messages'

export const PLATFORM_EXPLORER_BASE_URLS: Record<'mainnet' | 'testnet', string> = {
  mainnet: 'https://platform-explorer.pshenmic.dev',
  testnet: 'https://testnet.platform-explorer.pshenmic.dev'
}

export const PLATFORM_EXPLORER_PAGE_LIMIT = 100
// A source that keeps returning full pages would otherwise spin the walk forever.
export const PLATFORM_EXPLORER_MAX_PAGES = 200

// A refresh costs one page per source once the first walk has run.
export const PLATFORM_HISTORY_REFRESH_INTERVAL_MS = 60_000

// A broadcast transition still has to be committed and then indexed before the
// explorer will list it, so the refresh a send asks for looks more than once.
// Past the last of these the periodic refresh takes over.
export const PLATFORM_HISTORY_SEND_REFRESH_DELAYS_MS = [5_000, 20_000]

export const PLATFORM_EXPLORER_REQUEST_TIMEOUT_MS = 30_000
export const PLATFORM_EXPLORER_RETRY_DELAYS_MS = [300, 1_200]

// What the explorer will call a transition this wallet sends, so the row it
// writes itself folds into the rows the walks bring back instead of reading as
// a second transition.
export const SHIELDED_TRANSITION_TYPES:
Record<PoolSpendOperation | 'shield' | 'shieldFromAssetLock', string> = {
  shield: 'SHIELD',
  shieldFromAssetLock: 'SHIELD_FROM_ASSET_LOCK',
  unshield: 'UNSHIELD',
  shieldedTransfer: 'SHIELDED_TRANSFER',
  shieldedWithdrawal: 'SHIELDED_WITHDRAWAL',
  identityCreateFromShielded: 'IDENTITY_CREATE_FROM_SHIELDED_POOL',
}
