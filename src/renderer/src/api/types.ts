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

// getPlatformAddresses
export interface PlatformAddressDto {
  platformAddress: string
  balanceCredits: string
  nonce: number
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

export type ExchangeRates = Record<string, number>

export interface ExchangeRatesResult {
  rates: ExchangeRates
  changes24h: ExchangeRates
  updatedAt: number | null
  stale: boolean
}

export interface AmountWithUsd {
  amount: bigint | string
  usdAmount: string
}

export interface WalletBalanceDto {
  dash: AmountWithUsd
  credits: AmountWithUsd
}

export interface Contact {
  id: number
  label: string
  address: string
  network: Network
  createdAt: number
}

// sendTransaction
export interface SendResult {
  txid: string
  amount: string
  fee: string
  toAddress: string
  changeAddress: string | null
  peersAcked: number
}

export interface TxLockStatus {
  instantLocked: boolean
  chainlocked: boolean
  confirmed: boolean
}

export interface PlatformSendResult {
  stHash: string
  amountCredits: string
  feeCredits: string
  fromAddress: string
  toAddress: string
}

export type AssetLockFundingPhase =
  | 'idle'
  | 'resumable'
  | 'building'
  | 'broadcastingL1'
  | 'waitingChainLock'
  | 'broadcastingST'
  | 'done'
  | 'error'

export type AssetLockFundingKind = 'address' | 'shielded' | 'identity' | 'identityTopUp'

export interface AssetLockFundingState {
  phase: AssetLockFundingPhase
  kind: AssetLockFundingKind
  txid: string | null
  txHeight: number | null
  chainLockedHeight: number | null
  lockKind: 'instant' | 'chain' | null
  stHash: string | null
  toPlatformAddress: string | null
  identityIdentifier: string | null
  amountDuffs: string | null
  error: string | null
}

export interface IdentityCreateResult {
  identifier: string
  identityIndex: number
  stHash: string
  amountCredits: string
  feeCredits: string
  fromAddress: string
}

export interface ShieldResult {
  stHash: string
  amountCredits: string
  fromAddress: string
}

// shielded
export type ShieldedProverState = 'idle' | 'preparing' | 'ready' | 'error'

export interface ShieldedStatus {
  prover: ShieldedProverState
  ready: boolean
  error: string | null
}

export interface ShieldedPoolInfo {
  poolState: string | null
  notesCount: string | null
}

export interface ShieldedNoteInfo {
  index: number
  amount: string
  spent: boolean
  address: string
}

export type ShieldedSyncPhase = 'idle' | 'syncing' | 'recovering' | 'done' | 'error'

export interface ShieldedSyncState {
  phase: ShieldedSyncPhase
  fetched: number
  total: number
  balance: string | null
  notes: ShieldedNoteInfo[]
  error: string | null
  syncedAt: number | null
}

export type ShieldedSpendPhase = 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'

export interface ShieldedSpendState {
  phase: ShieldedSpendPhase
  fetched: number
  total: number
  stHash: string | null
  identityId: string | null
  error: string | null
}
