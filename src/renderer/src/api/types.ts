import { ShieldedSyncPhase } from '../enums/ShieldedSyncPhase'
import { ShieldedSpendPhase } from '../enums/ShieldedSpendPhase'
import { ShieldedProverState } from '../enums/ShieldedProverState'
import { WalletSyncPhase } from '../enums/WalletSyncPhase'
import { AssetLockFundingPhase } from '../enums/AssetLockFundingPhase'
import { AssetLockFundingKind } from '../enums/AssetLockFundingKind'
import { LockKind } from '../enums/LockKind'
import { ShieldedSpendKind } from '../enums/ShieldedSpendKind'
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

// estimateTransitionFee
export interface TransitionFeeInput {
  platformAddress: string
  index: number
  nonce: number
  credits: bigint
}

export type TransitionFeeQuery =
  | { kind: 'addressTransfer'; inputCount: number; recipients: string[] }
  | { kind: 'addressWithdrawal'; inputCount: number; hasChange: boolean }
  | { kind: 'shieldedSpend'; spendKind: ShieldedSpendKind; noteCount: number; recipients: string[] }
  | { kind: 'shield'; noteCount: number; inputCount: number; fromAssetLock: boolean; surplusAddress: string | null }
  | { kind: 'identityCreditsToAddresses'; identityId: string; recipients: { address: string; amountCredits: bigint }[] }
  | { kind: 'identityCreditTransfer'; identityId: string; recipientId: string; amountCredits: bigint }
  | { kind: 'identityWithdrawal'; identityId: string; amountCredits: bigint; coreAddress: string }
  | { kind: 'identityCreateFromAddresses'; inputs: TransitionFeeInput[] }
  | { kind: 'identityTopUpFromAddresses'; identityId: string; inputs: TransitionFeeInput[] }
  | {
      kind: 'addressFundingFromAssetLock'
      assetLockProof: { type: 'chainLock'; coreChainLockedHeight: number } | { type: 'instantLock'; instantLock: string; transaction: string }
      txid: string
      outputIndex: number
      recipient: string
    }

export interface TransitionFeeDto {
  minFeeCredits: bigint
  storageFeeCredits: bigint
  totalFeeCredits: bigint
  newAddresses: string[]
}

export interface TransitionFeeParams {
  destinationValid: boolean
  recipient: string
  amountCredits: bigint
  source: PlatformAddressDto | null
  identityId: string | null
}

export interface OperationFeeParams extends TransitionFeeParams {
  notes: ShieldedNoteInfo[] | null
}

export interface AmountValidationParams {
  isCoreOperation: boolean
  amount: string
  operation: TransferOperation | null
  amountDuffs: bigint
  balanceDuffs: bigint
  amountCredits: bigint
  minCredits: bigint
  availableCredits: bigint | null
  feeCredits: bigint | null
  maxPerTx: bigint | null
}

// getStatus
export type Network = 'mainnet' | 'testnet'

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
