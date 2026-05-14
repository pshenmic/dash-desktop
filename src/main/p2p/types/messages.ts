import {Network} from '../../src/types'
import {AppliedBlock, WalletSyncStatus, WalletSyncUtxo} from './walletSync'

// IPC envelopes between the main process and the p2p utility process.
// This file only describes the wire format — payload shapes (status,
// utxos, applied blocks) live in p2p/types.ts.
//
// Naming: P2P* = an envelope (the thing electron ships across processes).
// The payload it wraps is named for the consumer concept (WalletSync* /
// Applied*) since those types are also used by SQL writes and renderer
// code, not just IPC.

// ── Commands (main -> utility) ──────────────────────────────────────────────

export interface P2PStartMessage {
  type: 'start'
  network: Network
  walletId: string
  chainDbPath: string
  watchAddresses: string[]
  birthdayHeight?: number
  // Seed for the cfilter worker's in-memory spend-detection map. SQL is
  // the source of truth — main process queries TransactionDAO and ships
  // the unspent outputs in the start command so the utility process never
  // touches wallet-scoped storage.
  seedUtxos: WalletSyncUtxo[]
  // Persisted cfilter scan cursor (null = never synced). Worker resumes
  // from max(birthday, cfilterCursor + 1).
  cfilterCursor: number | null
}

export interface P2PStopMessage {
  type: 'stop'
}

export interface P2PAddWatchAddressesMessage {
  type: 'addWatchAddresses'
  walletId: string
  addresses: string[]
  // When set, the worker rewinds its cfilter cursor to this height so
  // historical filters get re-matched against the new addresses. The
  // main process is responsible for choosing the height (lowest birthday
  // across the new addresses, or 0/genesis if no birthday is tracked yet).
  rewindToHeight?: number
}

export type P2PCommand =
  | P2PStartMessage
  | P2PStopMessage
  | P2PAddWatchAddressesMessage

// ── Events (utility -> main) ────────────────────────────────────────────────

export interface P2PStatusMessage {
  type: 'status'
  status: WalletSyncStatus
}

export interface P2PBlockAppliedMessage {
  type: 'blockApplied'
  block: AppliedBlock
}

// Cursor-only advance — emitted at cfilter scan completion when the scan
// tip moves past a stretch of unmatched blocks. No tx data, just the
// resume marker.
export interface P2PCursorAdvancedMessage {
  type: 'cursorAdvanced'
  walletId: string
  height: number
}

export interface P2PErrorMessage {
  type: 'error'
  message: string
}

export type P2PEvent =
  | P2PStatusMessage
  | P2PBlockAppliedMessage
  | P2PCursorAdvancedMessage
  | P2PErrorMessage