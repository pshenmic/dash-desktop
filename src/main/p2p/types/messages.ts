import {Network} from '../../src/types'
import {BroadcastResult} from './broadcast'
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

// Broadcast a signed transaction over the active peer pool. requestId is
// echoed in the matching P2PBroadcastResultMessage so the main-process
// service can correlate concurrent broadcasts. Policy is not on the wire
// — the utility process reads BROADCAST_POLICY from constants.
export interface P2PBroadcastMessage {
  type: 'broadcast'
  requestId: string
  txHex: string
}

// Tell the utility process which locally-broadcast txids to watch for an
// InstantSend (isdlock) confirmation. The worker only fetches isdlock objects
// while this set is non-empty (they're high-volume to over-fetch), and emits
// P2PTxInstantLockedMessage when one matches. Empty list = stop watching.
export interface P2PWatchTxsMessage {
  type: 'watchTxs'
  walletId: string
  txids: string[]
}

export type P2PCommand =
  | P2PStartMessage
  | P2PStopMessage
  | P2PAddWatchAddressesMessage
  | P2PBroadcastMessage
  | P2PWatchTxsMessage

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

// Response to a P2PBroadcastMessage. ok=true carries the final result;
// ok=false carries the failure reason plus whatever partial state the
// session accumulated before giving up (peers invited, acks, etc).
export interface P2PBroadcastResultMessage {
  type: 'broadcastResult'
  requestId: string
  ok: boolean
  result: BroadcastResult
  errorMessage: string | null
}

// A watched local tx received a DIP-24 InstantSend lock — irreversibly final
// before it's even mined. Main flags it instant_locked.
export interface P2PTxInstantLockedMessage {
  type: 'txInstantLocked'
  walletId: string
  txid: string
}

// A ChainLock (clsig) was observed for `height` — every tx in blocks at or
// below it is irreversible. Main flags those txs chainlocked.
export interface P2PChainLockedMessage {
  type: 'chainLocked'
  walletId: string
  height: number
}

export type P2PEvent =
  | P2PStatusMessage
  | P2PBlockAppliedMessage
  | P2PCursorAdvancedMessage
  | P2PErrorMessage
  | P2PBroadcastResultMessage
  | P2PTxInstantLockedMessage
  | P2PChainLockedMessage