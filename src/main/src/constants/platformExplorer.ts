export const PLATFORM_EXPLORER_BASE_URLS: Record<'mainnet' | 'testnet', string> = {
  mainnet: 'https://platform-explorer.pshenmic.dev',
  testnet: 'https://testnet.platform-explorer.pshenmic.dev'
}

// The transitions endpoint validates its POST body against this ceiling and
// answers a longer list with `body/addresses must NOT have more than 100 items`.
export const PLATFORM_EXPLORER_ADDRESS_CHUNK = 100

// Prefixes an address walk's source, where an identity names itself. One per
// chunk: the amount on a row is the net across that chunk's addresses.
export const PLATFORM_EXPLORER_ADDRESS_SOURCE = 'addresses'

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
