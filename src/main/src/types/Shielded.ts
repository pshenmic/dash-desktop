import {ProverState} from '../../platform/types/messages'

export type ShieldedProverState = ProverState
export type ShieldedSyncPhase = 'idle' | 'syncing' | 'recovering' | 'done' | 'error'
export type ShieldedSpendPhase = 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'

export interface ShieldedStatus {
  prover: ShieldedProverState
  ready: boolean
  error: string | null
}

export interface ShieldedPoolInfo {
  poolState: string | null
  notesCount: string | null
}

export interface ShieldedNotesInfo {
  undecodedCount: number
}

export interface ShieldedNoteInfo {
  index: number
  amount: string
  spent: boolean
  address: string
}

export interface ShieldedSyncState {
  phase: ShieldedSyncPhase
  fetched: number
  total: number
  balance: string | null
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