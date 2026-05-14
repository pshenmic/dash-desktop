import {Network} from '../../src/types'

// Domain types for the wallet sync subsystem. These describe the data
// model — what wallet state looks like, what a status snapshot contains,
// what a per-block apply payload carries — independent of how it gets
// transported. The IPC envelope layer (p2p/messages.ts) wraps these for
// the wire; the SQL layer (TransactionDAO) consumes the apply payload
// directly.

// ── Sync status ─────────────────────────────────────────────────────────────

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

  // Peers
  peerCount: number
  // Subset of peers advertising NODE_COMPACT_FILTERS — required for cfilter
  // requests to succeed.
  filterCapablePeerCount: number

  // Estimated milliseconds remaining until the current phase completes.
  phaseEtaMs: number | null

  lastError: string | null
  updatedAt: number
}

// ── UTXO snapshot ───────────────────────────────────────────────────────────

export interface WalletSyncUtxo {
  txid: string
  vout: number
  satoshis: string
  address: string
  height: number
}

// ── BlockApplied payload ────────────────────────────────────────────────────
//
// Per-matched-block effects emitted by the cfilter worker, consumed by
// TransactionDAO.applyBlock. Same shape on the wire and at the SQL boundary.

// Output as-recorded for the wallet. address may be null for non-standard
// scripts (OP_RETURN, exotic multisig); we still store the row so a future
// SQL-backed tx-info API has the full output set.
export interface AppliedTxOutput {
  vout: number
  address: string | null
  satoshis: string
  isMine: boolean
}

export interface AppliedTxInput {
  vin: number
  prevTxid: string
  prevVout: number
  sequence: number
}

export interface AppliedTx {
  txid: string
  // Raw tx bytes — stored as BLOB so explorer-style views can re-parse
  // without going back to a peer. Postable via electron utilityProcess
  // postMessage (Uint8Array passes through structuredClone).
  raw: Uint8Array
  inputs: AppliedTxInput[]
  outputs: AppliedTxOutput[]
}

// Back-edge: an input of one of the txs above spends a previously-recorded
// output of ours. The worker resolves the linkage via its in-memory UTXO
// map (cheap O(1)); SQL just records spent_in_txid + spent_at_height.
export interface AppliedSpend {
  prevTxid: string
  prevVout: number
  spentInTxid: string
}

export interface AppliedBlock {
  walletId: string
  height: number
  blockHash: string
  blockTime: number
  txs: AppliedTx[]
  spends: AppliedSpend[]
}