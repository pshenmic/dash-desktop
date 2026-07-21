import {Network} from '../../src/types'

export type ShieldedProverState = 'idle' | 'preparing' | 'ready' | 'error'
export type ShieldedSyncPhase = 'idle' | 'syncing' | 'recovering' | 'done' | 'error'
export type ShieldedSpendPhase = 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'
export type ShieldedSpendKind = 'transfer' | 'unshield' | 'withdrawal' | 'identityCreate'

export interface ShieldedNoteSnapshot {
  index: number
  amount: string
  spent: boolean
  address: string
}

export interface ShieldSource {
  platformAddress: string
  nonce: number
  balanceCredits: string
  index: number
}

export type ShieldAssetLockProofParams =
  | { type: 'chainLock'; coreChainLockedHeight: number }
  | { type: 'instantLock'; instantLock: string; transaction: string }

export type ShieldedCommand =
  | { type: 'initProver' }
  | { type: 'sync'; requestId: string; network: Network; seed: Uint8Array; spentIndexes: number[] }
  | {
      type: 'spend'
      requestId: string
      network: Network
      seed: Uint8Array
      spentIndexes: number[]
      kind: ShieldedSpendKind
      recipient: string
      amountCredits: string
      noteIndexes?: number[]
      identityIndex?: number
      failureAddress?: string
    }
  | { type: 'shield'; requestId: string; network: Network; seed: Uint8Array; source: ShieldSource; recipient: string; amountCredits: string }
  | {
      type: 'shieldFromAssetLock'
      requestId: string
      network: Network
      seed: Uint8Array
      txid: string
      outputIndex: number
      assetLockProof: ShieldAssetLockProofParams
      creditDerivationPath: string
      recipient: string
      shieldAmountCredits: string
      surplusAddress: string | null
    }

export type ShieldedEvent =
  | { type: 'proverStatus'; state: ShieldedProverState; error: string | null }
  | { type: 'syncProgress'; requestId: string; phase: ShieldedSyncPhase; fetched: number; total: number }
  | { type: 'syncResult'; requestId: string; ok: boolean; balance: string | null; notes: ShieldedNoteSnapshot[]; error: string | null }
  | { type: 'spendProgress'; requestId: string; phase: ShieldedSpendPhase; fetched: number; total: number }
  | { type: 'notesSpent'; requestId: string; indexes: number[] }
  | { type: 'spendResult'; requestId: string; ok: boolean; stHash: string | null; identityId?: string | null; error: string | null }
  | { type: 'shieldResult'; requestId: string; ok: boolean; stHash: string | null; error: string | null }
  | { type: 'error'; message: string }
