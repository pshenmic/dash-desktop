export const PLATFORM_EXPLORER_BASE_URLS: Record<'mainnet' | 'testnet', string> = {
  mainnet: 'https://platform-explorer.pshenmic.dev',
  testnet: 'https://testnet.platform-explorer.pshenmic.dev'
}

// The batch endpoints reject more than 100 addresses per call.
export const PLATFORM_EXPLORER_ADDRESS_CHUNK = 100

// Names the address walk in a cached row's source column, where an identity
// names itself. The whole set is one source because the explorer aggregates a
// transition across every requested address before reporting it.
export const PLATFORM_EXPLORER_ADDRESS_SOURCE = 'addresses'

export const PLATFORM_EXPLORER_PAGE_LIMIT = 100
// A source that keeps returning full pages would otherwise spin the walk forever.
export const PLATFORM_EXPLORER_MAX_PAGES = 200

export const PLATFORM_EXPLORER_REQUEST_TIMEOUT_MS = 30_000
export const PLATFORM_EXPLORER_RETRY_DELAYS_MS = [300, 1_200]
