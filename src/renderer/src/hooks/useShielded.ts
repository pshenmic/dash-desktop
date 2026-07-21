import { useEffect, useState } from 'react'
import { API } from '@renderer/api'
import { Network, ShieldedPoolInfo, ShieldedStatus, ShieldedSyncState } from '@renderer/api/types'
import { useAsyncWithCache } from './useAsyncWithCache'

const INITIAL_STATUS: ShieldedStatus = { prover: 'idle', ready: false, error: null }

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
        if (next.prover !== 'ready' && next.prover !== 'error') {
          timer = setTimeout(() => { void poll() }, 1500)
        }
      } catch {
        if (!dead) timer = setTimeout(() => { void poll() }, 2000)
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

const SHIELDED_POOL_REFRESH_MS = 15_000

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

const INITIAL_SYNC_STATE: ShieldedSyncState = {
  phase: 'idle', fetched: 0, total: 0, balance: null, notes: [], error: null, syncedAt: null
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

    const poll = async (): Promise<void> => {
      let running = false
      try {
        const next = await API.getShieldedSyncState(walletId)
        if (dead) return
        setState(next)
        running = next.phase === 'syncing' || next.phase === 'recovering'
      } catch {
        /* keep last state, retry */
      }
      if (!dead) timer = setTimeout(() => { void poll() }, running ? 600 : 2500)
    }

    void poll()

    return () => {
      dead = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [walletId])

  return state
}
