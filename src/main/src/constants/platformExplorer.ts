export const PLATFORM_EXPLORER_BASE_URLS: Record<'mainnet' | 'testnet', string> = {
  mainnet: 'https://platform-explorer.pshenmic.dev',
  testnet: 'https://testnet.platform-explorer.pshenmic.dev'
}

// The batch endpoints reject more than 100 addresses per call.
export const PLATFORM_EXPLORER_ADDRESS_CHUNK = 100

export const PLATFORM_EXPLORER_PAGE_LIMIT = 100
// A source that keeps returning full pages would otherwise spin the walk forever.
export const PLATFORM_EXPLORER_MAX_PAGES = 200

export const PLATFORM_EXPLORER_REQUEST_TIMEOUT_MS = 30_000
export const PLATFORM_EXPLORER_RETRY_DELAYS_MS = [300, 1_200]
