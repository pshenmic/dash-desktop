import { useEffect, useState } from 'react'
import { API } from '@renderer/api'
import { Network, ShieldedNoteInfo, ShieldedNotesInfo, ShieldedPoolInfo, ShieldedStatus, ShieldedSyncState } from '@renderer/api/types'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import { ShieldedProverState } from '@renderer/enums/ShieldedProverState'
import {
  SHIELDED_NOTES_INFO_CACHE_NS,
  SHIELDED_NOTES_INFO_POLL_MS,
  SHIELDED_POOL_REFRESH_MS,
  SHIELDED_STATUS_POLL_MS,
  SHIELDED_STATUS_RETRY_MS,
  SHIELDED_SYNC_ACTIVE_POLL_MS,
  SHIELDED_SYNC_IDLE_POLL_MS
} from '@renderer/constants'
import { invalidateAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

const INITIAL_STATUS: ShieldedStatus = { prover: ShieldedProverState.Idle, ready: false, error: null }

export function useShieldedStatus(): ShieldedStatus {
  const [status, setStatus] = useState<ShieldedStatus>(INITIAL_STATUS)

  useEffect(() => {
    let dead = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async (): Promise<void> => {
      try {
        const next = await API.getShieldedStatus()
        if (dead) return
        setStatus(next)
        if (next.prover !== ShieldedProverState.Ready && next.prover !== ShieldedProverState.Error) {
          timer = setTimeout(() => { void poll() }, SHIELDED_STATUS_POLL_MS)
        }
      } catch {
        if (!dead) timer = setTimeout(() => { void poll() }, SHIELDED_STATUS_RETRY_MS)
      }
    }

    void poll()

    return () => {
      dead = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [])

  return status
}

const INITIAL_POOL_INFO: ShieldedPoolInfo = { poolState: null, notesCount: null }

export function useShieldedPoolInfo(network: Network | undefined): {
  poolInfo: ShieldedPoolInfo
  loading: boolean
  err: string | null
} {
  const { data, loading, err } = useAsyncWithCache<ShieldedPoolInfo>(
    'shielded-pool',
    network,
    () => API.getShieldedPoolInfo(network!),
    INITIAL_POOL_INFO,
    { errorMessage: 'Failed to load shielded pool info', refreshIntervalMs: SHIELDED_POOL_REFRESH_MS }
  )
  return { poolInfo: data, loading, err }
}

const INITIAL_NOTES_INFO: ShieldedNotesInfo = { undecodedCount: 0 }

export function useShieldedNotesInfo(walletId: string | undefined): { info: ShieldedNotesInfo, loading: boolean } {
  const { data, loading } = useAsyncWithCache<ShieldedNotesInfo>(
    SHIELDED_NOTES_INFO_CACHE_NS,
    walletId,
    () => API.getShieldedNotesInfo(walletId!),
    INITIAL_NOTES_INFO,
    { errorMessage: 'Failed to load shielded notes info', refreshIntervalMs: SHIELDED_NOTES_INFO_POLL_MS }
  )
  return { info: data, loading }
}

const INITIAL_SYNC_STATE: ShieldedSyncState = {
  phase: ShieldedSyncPhase.Idle, fetched: 0, total: 0, balance: null, notes: [], error: null, syncedAt: null
}

function isSameNotes(a: ShieldedNoteInfo[], b: ShieldedNoteInfo[]): boolean {
  return a.length === b.length && a.every((note, i) => note.index === b[i].index
    && note.amount === b[i].amount
    && note.spent === b[i].spent
    && note.address === b[i].address)
}

function isSameSyncState(a: ShieldedSyncState, b: ShieldedSyncState): boolean {
  return a.phase === b.phase
    && a.fetched === b.fetched
    && a.total === b.total
    && a.balance === b.balance
    && a.error === b.error
    && a.syncedAt === b.syncedAt
    && isSameNotes(a.notes, b.notes)
}

export function useShieldedSyncState(walletId: string | null | undefined): ShieldedSyncState {
  const [state, setState] = useState<ShieldedSyncState>(INITIAL_SYNC_STATE)

  useEffect(() => {
    if (!walletId) {
      setState(INITIAL_SYNC_STATE)
      return
    }

    let dead = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let wasRunning = false

    const poll = async (): Promise<void> => {
      let running = false
      try {
        const next = await API.getShieldedSyncState(walletId)
        if (dead) return
        setState(prev => isSameSyncState(prev, next) ? prev : next)
        running = next.phase === ShieldedSyncPhase.Syncing || next.phase === ShieldedSyncPhase.Recovering
        if (wasRunning && !running) invalidateAsyncCache(SHIELDED_NOTES_INFO_CACHE_NS, walletId)
        wasRunning = running
      } catch {
        /* keep last state, retry */
      }
      if (!dead) timer = setTimeout(() => { void poll() }, running ? SHIELDED_SYNC_ACTIVE_POLL_MS : SHIELDED_SYNC_IDLE_POLL_MS)
    }

    void poll()

    return () => {
      dead = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [walletId])

  return state
}

export function useShieldedCredits(walletId: string | null | undefined): bigint {
  const { phase, balance } = useShieldedSyncState(walletId)
  return phase === ShieldedSyncPhase.Done ? balance ?? 0n : 0n
}
