import {Network} from '../src/types'

// Internal protocol between main process and the p2p utility process.
// Commands/envelopes are P2P-named (they describe the wire); the status
// payload is WalletSync-named (it's the consumer-facing concept).

export interface P2PStartMessage {
  type: 'start'
  network: Network
  walletId: string
  chainDbPath: string
  startHeight: number
  startHash: string | null
  watchAddresses: string[]
  birthdayHeight?: number
}

export interface P2PStopMessage {
  type: 'stop'
}

export interface P2PAddWatchAddressesMessage {
  type: 'addWatchAddresses'
  walletId: string
  addresses: string[]
}

export type P2PCommand =
  | P2PStartMessage
  | P2PStopMessage
  | P2PAddWatchAddressesMessage

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

  // Headers
  tipHeight: number
  tipHash: string | null
  // Best height advertised by any connected peer — proxy for the live chain
  // tip. Used by the renderer to compute % progress during header sync.
  estimatedChainHeight: number

  // CFilter sub-phases
  // Walk frontier: highest height with a verified filter header (cfheaders
  // walk). Lags tipHeight during cfheaders phase, equal once walk is done.
  cfheadersHeight: number
  // Scan cursor: highest height whose cfilter has been matched against the
  // wallet's watch set.
  cfilterScanHeight: number
  // Matched blocks awaiting full-block fetch (or already fetched, awaiting
  // application). Useful when scan is "stuck" waiting for a peer to deliver.
  matchedBlocksPending: number

  // Wallet
  utxoCount: number
  // Sum of all UTXOs in satoshis, serialized as a decimal string (bigint
  // doesn't survive JSON).
  totalBalance: string

  // Peers
  peerCount: number
  // Subset of peers advertising NODE_COMPACT_FILTERS — required for cfilter
  // requests to succeed.
  filterCapablePeerCount: number

  lastError: string | null
  updatedAt: number
}

export interface WalletSyncUtxo {
  txid: string
  vout: number
  satoshis: string
  address: string
  height: number
}

export interface P2PStatusMessage {
  type: 'status'
  status: WalletSyncStatus
}

export interface P2PUtxosMessage {
  type: 'utxos'
  utxos: WalletSyncUtxo[]
}

export interface P2PErrorMessage {
  type: 'error'
  message: string
}

export type P2PEvent = P2PStatusMessage | P2PUtxosMessage | P2PErrorMessage