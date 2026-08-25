import { ShieldedSyncPhase } from '../enums/ShieldedSyncPhase'
import { ShieldedSpendPhase } from '../enums/ShieldedSpendPhase'
import { ShieldedProverState } from '../enums/ShieldedProverState'
import { WalletSyncPhase } from '../enums/WalletSyncPhase'
import { AssetLockFundingPhase } from '../enums/AssetLockFundingPhase'
import { AssetLockFundingKind } from '../enums/AssetLockFundingKind'
import { LockKind } from '../enums/LockKind'
import { TransferOperation } from '../enums/TransferOperation'

export { ShieldedSpendPhase, ShieldedProverState, WalletSyncPhase, AssetLockFundingPhase, AssetLockFundingKind, LockKind }

export interface LogFileInfo {
  name: string
  size: number
  modifiedAt: number
  rotated: boolean
}

export interface LogFileContent extends LogFileInfo {
  content: string
}

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
  txCount: number
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
  balanceCredits: bigint
  nonce: number
}

// estimateFee — the one fee endpoint. What gets priced for each operation is
// the backend's business; this carries only what the user chose.
export interface FeeParams {
  amountCredits: bigint
  // Whatever kind of address this operation pays. The transfer screens pay one,
  // so they never need the list form.
  recipient: string | string[]
  sourceAddress: string | null
  identityId: string | null
  // Restricts a pool spend to one shielded address's notes.
  noteIndexes: number[] | null
}

// feeDuffs is what L1 charges on top of the amount, feeCredits what L2 takes
// out of it. An L1 -> L2 transfer is two transactions and carries both; every
// other operation carries one, and null means it cannot be priced yet.
// maxPerTx and noteLimit are pool-spend facts: nothing else is capped by
// anything but the balance.
export interface OperationFee {
  feeCredits: bigint | null
  feeDuffs: bigint | null
  maxPerTx: bigint | null
  noteLimit: number | null
}

export interface OperationFeeParams extends FeeParams {
  destinationValid: boolean
}

export interface AmountValidationParams {
  isCoreOperation: boolean
  amount: string
  // Every fee the send pays in Dash. An L1 -> L2 transfer locks the L2 fee too,
  // so the amount asked for is the amount that arrives.
  totalFeeDuffs: bigint
  operation: TransferOperation | null
  amountDuffs: bigint
  balanceDuffs: bigint
  amountCredits: bigint
  minCredits: bigint
  availableCredits: bigint | null
  feeCredits: bigint | null
  maxPerTx: bigint | null
  noteLimit: number | null
}

// getStatus
export type Network = 'mainnet' | 'testnet'
export type ConnectionStatus = 'connecting' | 'online' | 'unavailable' | 'synced' | 'syncing' | 'sync-stopped'

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
  lockPeerCount: number
  phaseEtaMs: number | null
  lastError: string | null
  updatedAt: number
}

export interface AppStatus {
  ready: boolean
  selectedWalletId: string | null
  network: Network | null
  connectionStatus: ConnectionStatus | null
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
  platformFeeMultiplier: number
  coreFeeMultiplier: number
}

export interface PeerOverridesJSON {
  dnsSeeds: string[]
  peers: string[]
}

export interface NetworkPreferencesJSON {
  mainnet: PeerOverridesJSON
  testnet: PeerOverridesJSON
}

export interface PreferencesJSON {
  version: number
  general: GeneralPreferencesJSON
  network: NetworkPreferencesJSON
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
  amount: bigint
  fee: bigint
  toAddress: string
  changeAddress: string | null
  peersAcked: number
}

export interface TransactionInput {
  value: string
  n: number
  addr: string
  prevTxId: string
  prevVout: number
  sequence: number
}

export interface TransactionOutput {
  value: string
  n: number
  address: string
  spentTxId: string
  spentIndex: number
  spentHeight: number
}

// getTransactions / getTransactionByHash
export interface Transaction {
  address: string
  // -1 spent from this wallet, 1 received into it
  direction: number
  inAmount: bigint
  outAmount: bigint
  transferAmount: bigint
  usdAmount: string
  date: Date
  size: number
  // 0 while the tx is only in the mempool
  blockHeight: number
  status: 'Pending' | 'Locked'
  walletId: string
  confirmations: number
  txid: string
  vin: TransactionInput[]
  vout: TransactionOutput[]
  // A DIP-24 lock makes a tx final before any block carries it, so an
  // unconfirmed tx can still be irreversible.
  instantLocked: boolean
  chainlocked: boolean
  // Whether this wallet broadcast it. Only meaningful while unconfirmed, and
  // null from sources that cannot know — the chain does not record provenance.
  isLocal: boolean | null
}

export interface TxLockStatus {
  instantLocked: boolean
  chainlocked: boolean
  confirmed: boolean
}

export interface PlatformSendResult {
  stHash: string
  amountCredits: bigint
  feeCredits: bigint
  fromAddress: string
  toAddress: string
}

export interface AssetLockFundingState {
  phase: AssetLockFundingPhase
  kind: AssetLockFundingKind
  txid: string | null
  txHeight: number | null
  chainLockedHeight: number | null
  lockKind: LockKind | null
  stHash: string | null
  toPlatformAddress: string | null
  identityIdentifier: string | null
  amountDuffs: bigint | null
  error: string | null
}

export interface IdentityCreateResult {
  identifier: string
  identityIndex: number
  stHash: string
  amountCredits: bigint
  feeCredits: bigint
  fromAddress: string
}

export interface ShieldResult {
  stHash: string
  amountCredits: bigint
  fromAddress: string
}

// shielded

export interface ShieldedStatus {
  prover: ShieldedProverState
  ready: boolean
  error: string | null
}

export interface ShieldedPoolInfo {
  poolState: bigint | null
  notesCount: bigint | null
}

export interface ShieldedNotesInfo {
  undecodedCount: number
}

export interface ShieldedNoteInfo {
  index: number
  amount: bigint
  spent: boolean
  address: string
}

export { ShieldedSyncPhase }

export interface ShieldedSyncState {
  phase: ShieldedSyncPhase
  fetched: number
  total: number
  balance: bigint | null
  notes: ShieldedNoteInfo[]
  error: string | null
  syncedAt: number | null
}

export interface ShieldedSpendState {
  phase: ShieldedSpendPhase
  fetched: number
  total: number
  stHash: string | null
  identityId: string | null
  error: string | null
}
