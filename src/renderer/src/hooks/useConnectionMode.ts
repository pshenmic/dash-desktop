import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import { ConnectionType, WalletSyncPhase } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'

const LS_DESIRED_KEY = 'wallet.connection.desired'
const CONNECTION_TYPES: readonly ConnectionType[] = ['rpc', 'p2p']

export function readDesired(): ConnectionType {
  const raw = localStorage.getItem(LS_DESIRED_KEY)
  return CONNECTION_TYPES.includes(raw as ConnectionType) ? (raw as ConnectionType) : 'rpc'
}

function isP2pInactive(phase: WalletSyncPhase | undefined): boolean {
  return phase === undefined || phase === WalletSyncPhase.Stopped || phase === WalletSyncPhase.Idle
}

export interface UseConnectionMode {
  desired: ConnectionType
  showSyncUI: boolean
  fallbackActive: boolean
  setDesired: (next: ConnectionType) => void
}

export function useConnectionMode(): UseConnectionMode {
  const { status } = useAuth()
  const phase = status?.walletSync.phase
  const walletId = status?.selectedWalletId ?? null
  const activeSyncWalletId = status?.walletSync.walletId ?? null
  const [desired, setDesiredState] = useState<ConnectionType>(readDesired)

  const phaseRef = useRef<WalletSyncPhase | undefined>(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

  const lastApplied = useRef<ConnectionType | null>(null)
  useEffect(() => {
    let cancelled = false
    API.getPreferences()
      .then(p => { if (!cancelled) lastApplied.current = p.general.connectionType })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (lastApplied.current === null) return
    const target: ConnectionType = desired === 'p2p' && phase === WalletSyncPhase.Synced ? 'p2p' : 'rpc'
    if (target === lastApplied.current) return
    const previous = lastApplied.current
    lastApplied.current = target
    API.setConnectionType(target).catch(() => { lastApplied.current = previous })
  }, [desired, phase])

  const autoStartedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!walletId) return

    // A sync running for a different wallet than the selected one is stale
    // (e.g. the user switched networks). Its phase/data belong to the old
    // wallet — stop it. Once it reports 'stopped' this effect re-runs and the
    // logic below decides whether to auto-start the newly-selected wallet.
    if (activeSyncWalletId && activeSyncWalletId !== walletId && !isP2pInactive(phaseRef.current)) {
      autoStartedFor.current = null
      API.stopWalletSync().catch(err => console.error('stale stopWalletSync failed', err))
      return
    }

    if (desired !== 'p2p') return
    if (autoStartedFor.current === walletId) return
    if (!isP2pInactive(phaseRef.current)) {
      autoStartedFor.current = walletId
      return
    }
    let cancelled = false
    API.hasSyncProgress(walletId)
      .then(hasProgress => {
        if (cancelled) return
        if (!hasProgress) return
        if (autoStartedFor.current === walletId) return
        if (!isP2pInactive(phaseRef.current)) return
        autoStartedFor.current = walletId
        API.startWalletSync(walletId).catch(err => console.error('auto startWalletSync failed', err))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [walletId, desired, phase, activeSyncWalletId])

  const setDesired = useCallback((next: ConnectionType) => {
    localStorage.setItem(LS_DESIRED_KEY, next)
    setDesiredState(next)
    if (next === 'p2p' && walletId && isP2pInactive(phaseRef.current)) {
      API.startWalletSync(walletId).catch(err => console.error('startWalletSync failed', err))
    } else if (next === 'rpc' && !isP2pInactive(phaseRef.current)) {
      API.stopWalletSync().catch(err => console.error('stopWalletSync failed', err))
    }
  }, [walletId])

  const fallbackActive = useMemo(
    () => desired === 'p2p' && phase !== WalletSyncPhase.Synced,
    [desired, phase],
  )

  return {
    desired,
    showSyncUI: desired === 'p2p',
    fallbackActive,
    setDesired,
  }
}
