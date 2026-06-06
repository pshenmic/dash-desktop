// getAddresses
export type WalletAddressDto = {
  walletId: string
  accountId: number
  address: string
  derivationPath: string
  index: number
  isChange: number
  isUsed: boolean
  balance: bigint
  label: string | null
  usdBalance: string | null
}
export type GetAddressesResponse = {
  receiving: WalletAddressDto[]
  change: WalletAddressDto[]
}

// getStatus
export type Network = 'mainnet' | 'testnet'

export type WalletSyncPhase =
  | 'idle'
  | 'connecting'
  | 'syncing-headers'
  | 'synced-headers'
  | 'syncing-cfcheckpt'
  | 'syncing-cfheaders'
  | 'syncing-cfilters'
  | 'synced'
  | 'stopped'

export interface WalletSyncStatus {
  phase: WalletSyncPhase
  network: Network | null
  walletId: string | null
  tipHeight: number
  tipHash: string | null
  estimatedChainHeight: number
  cfheadersHeight: number
  cfilterScanHeight: number
  matchedBlocksPending: number
  peerCount: number
  filterCapablePeerCount: number
  phaseEtaMs: number | null
  lastError: string | null
  updatedAt: number
}

export interface AppStatus {
  ready: boolean
  selectedWalletId: string | null
  network: Network | null
  walletSync: WalletSyncStatus
}

// getAllWallets
export interface WalletDto {
  walletId: string
  network: Network
  selected: boolean
  label?: string | null
  encryptedMnemonic?: string
}

// preferences
export type ConnectionType = 'p2p' | 'rpc'

export interface GeneralPreferencesJSON {
  language: string
  currency: string
  connectionType: ConnectionType
}

export interface PreferencesJSON {
  version: number
  general: GeneralPreferencesJSON
}

export interface QueryStatus {
  success: boolean
  errorMessage: string | null
}
