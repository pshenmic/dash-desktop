import {Network} from '../../src/types'

// Domain types for wallet sync, independent of transport: messages.ts wraps
// them for the wire, TransactionDAO consumes the apply payload directly.

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
  // Best height advertised by any connected peer — proxy for the live chain tip.
  estimatedChainHeight: number

  // CFilter sub-phases
  // Highest height with a verified filter header. Lags tipHeight during the
  // cfheaders walk, equal once it is done.
  cfheadersHeight: number
  // Highest height whose cfilter has been matched against the watch set.
  cfilterScanHeight: number
  // Matched blocks awaiting full-block fetch or application — tells you why a
  // scan looks stuck.
  matchedBlocksPending: number

  // Peers
  peerCount: number
  // Subset advertising NODE_COMPACT_FILTERS, without which cfilter requests fail.
  filterCapablePeerCount: number
  // Separate set from the counts above: the lock pool runs even when no chain
  // sync does. Zero here means locks cannot be detected.
  lockPeerCount: number

  phaseEtaMs: number | null

  lastError: string | null
  updatedAt: number
}

// ── Watch set ───────────────────────────────────────────────────────────────

// The derivation index travels with the address so the worker can tell, without
// asking main, whether a block just consumed the last unused address.
export interface WatchAddress {
  address: string
  index: number
  isChange: boolean
  isUsed: boolean
}

// The scan stopped: fewer than gapLimit unused addresses remain above lastUsed
// on this chain, so blocks past `height` cannot be matched correctly until main
// derives more. The scan resumes at height + 1, never from genesis.
export interface GapExhausted {
  walletId: string
  height: number
  isChange: boolean
  lastUsedIndex: number
  maxIndex: number
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

// address is null for non-standard scripts (OP_RETURN, exotic multisig); the
// row is still stored so a future tx-info API has the full output set.
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
  // Stored as BLOB so explorer-style views can re-parse without going back to a
  // peer. Uint8Array survives structuredClone, so it posts across the process
  // boundary as-is.
  raw: Uint8Array
  inputs: AppliedTxInput[]
  outputs: AppliedTxOutput[]
}

// Back-edge: an input above spends a previously-recorded output of ours. The
// worker resolves the linkage from its in-memory UTXO map; SQL just records it.
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