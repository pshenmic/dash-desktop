import {Network} from '../../src/types'
import {BroadcastPolicyOverrides, BroadcastResult} from './broadcast'
import {PeerOverrides} from './pool'
import {AppliedBlock, GapExhausted, WalletSyncStatus, WalletSyncUtxo, WatchAddress} from './walletSync'

// IPC envelopes between the main process and the p2p utility process. P2P* is
// the envelope; the payload keeps its consumer-side name (WalletSync* /
// Applied*) because SQL writes and renderer code use those types too.

// ── Commands (main -> utility) ──────────────────────────────────────────────

export interface P2PStartMessage {
  type: 'start'
  network: Network
  walletId: string
  chainDbPath: string
  watchAddresses: WatchAddress[]
  // BIP-44 lookahead. The worker holds the scan once fewer than this many
  // unused addresses remain above the highest used index on either chain.
  gapLimit: number
  birthdayHeight?: number
  // Shipped in the command rather than read by the worker, so the utility
  // process never touches wallet-scoped storage — SQL stays the source of truth.
  seedUtxos: WalletSyncUtxo[]
  // null = never synced. Worker resumes from max(birthday, cfilterCursor + 1).
  cfilterCursor: number | null
  peerOverrides?: PeerOverrides
}

// Lock pool only — no chain.db, no header/cfilter sync. What an rpc-mode wallet
// runs: it needs locks for asset-lock funding but must not download the chain.
// `start` is a superset and brings the same core up.
export interface P2PListenMessage {
  type: 'listen'
  network: Network
  peerOverrides?: PeerOverrides
}

export interface P2PStopMessage {
  type: 'stop'
}

export interface P2PAddWatchAddressesMessage {
  type: 'addWatchAddresses'
  walletId: string
  addresses: WatchAddress[]
  // Rewinds the cfilter cursor so historical filters re-match the new
  // addresses. Main picks the height — the worker does not decide.
  rewindToHeight?: number
}

// requestId is echoed back in P2PBroadcastResultMessage so concurrent
// broadcasts can be correlated. `policy` overrides individual BROADCAST_POLICY
// defaults — an asset lock waits for its lock where an ordinary send returns on
// peer acks.
export interface P2PBroadcastMessage {
  type: 'broadcast'
  requestId: string
  txHex: string
  policy?: BroadcastPolicyOverrides
}

// Which txids to watch for an isdlock. The worker only fetches isdlock objects
// while this set is non-empty — they are high-volume to over-fetch.
//
// 'add' exists because the periodic 'replace' derives its set from SQL, which
// does not yet know about a txid armed moments earlier by a broadcast.
export interface P2PWatchTxsMessage {
  type: 'watchTxs'
  mode: 'add' | 'replace'
  txids: string[]
}

// The post-rewind UTXO set, answering P2PChainRewoundMessage. The worker's scan
// stays held until this lands — its in-memory spend map still carries outputs
// from the orphaned branch until then.
export interface P2PReseedUtxosMessage {
  type: 'reseedUtxos'
  walletId: string
  utxos: WalletSyncUtxo[]
}

export type P2PCommand =
  | P2PStartMessage
  | P2PListenMessage
  | P2PStopMessage
  | P2PAddWatchAddressesMessage
  | P2PBroadcastMessage
  | P2PWatchTxsMessage
  | P2PReseedUtxosMessage

// ── Events (utility -> main) ────────────────────────────────────────────────

export interface P2PStatusMessage {
  type: 'status'
  status: WalletSyncStatus
}

export interface P2PBlockAppliedMessage {
  type: 'blockApplied'
  block: AppliedBlock
}

// Resume marker only, no tx data — the scan tip moved past unmatched blocks.
export interface P2PCursorAdvancedMessage {
  type: 'cursorAdvanced'
  walletId: string
  height: number
}

// The worker's echo of an addWatchAddresses rewind. Main resets the cursor
// before sending the command, but a cursorAdvanced already emitted by the
// worker can land after that reset and MAX the cursor back up; this echo
// shares the worker's ordered event channel, so it arrives after every
// pre-rewind advance and re-applies the rewind on top of them.
export interface P2PCursorResetMessage {
  type: 'cursorReset'
  walletId: string
  height: number
}

// The scan is held until main answers with addWatchAddresses. Nothing resumes
// it on a timer — a silent resume would scan blocks against a watch set already
// known to be short.
export interface P2PGapExhaustedMessage {
  type: 'gapExhausted'
  gap: GapExhausted
}

export interface P2PErrorMessage {
  type: 'error'
  message: string
}

// ok=false still carries whatever partial state the session accumulated before
// giving up.
export interface P2PBroadcastResultMessage {
  type: 'broadcastResult'
  requestId: string
  ok: boolean
  result: BroadcastResult
  errorMessage: string | null
}

// A DIP-24 InstantSend lock — irreversibly final before the tx is even mined.
export interface P2PTxInstantLockedMessage {
  type: 'txInstantLocked'
  txid: string
  // Reused to build an InstantAssetLockProof for shield / asset-lock funding
  // without depending on DAPI islock delivery.
  islockHex: string
}

// Every tx in blocks at or below `height` is irreversible.
export interface P2PChainLockedMessage {
  type: 'chainLocked'
  network: Network
  height: number
}

// A competing branch outweighed ours and blocks above `height` were orphaned.
// Main un-confirms their transactions and answers with reseedUtxos.
export interface P2PChainRewoundMessage {
  type: 'chainRewound'
  walletId: string
  height: number
}

export type P2PEvent =
  | P2PStatusMessage
  | P2PBlockAppliedMessage
  | P2PCursorAdvancedMessage
  | P2PCursorResetMessage
  | P2PGapExhaustedMessage
  | P2PErrorMessage
  | P2PBroadcastResultMessage
  | P2PTxInstantLockedMessage
  | P2PChainLockedMessage
  | P2PChainRewoundMessage