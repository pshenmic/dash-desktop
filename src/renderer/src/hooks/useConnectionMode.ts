import { useCallback, useEffect, useRef, useState } from 'react'
import { API } from '@renderer/api'
import { ConnectionType, WalletSyncPhase } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { toast } from '@renderer/components/ui/Toast'
import { getErrorMessage } from '@renderer/utils/error'
import { invalidateAllAsyncCaches } from './useAsyncWithCache'
import {
  isWalletSyncInactive,
  isWalletSyncIncomplete,
  shouldSuppressNearTipSyncProgress,
  shouldShowWalletSyncUI,
} from '@renderer/utils/walletSync'
import type {CompletedSyncSnapshot} from '@renderer/types/connection'
import {
  isWalletSyncEnabled,
  readDesiredConnectionMode,
  setDesiredConnectionMode,
} from '@renderer/utils/connectionSettings'

export interface UseConnectionMode {
  desired: ConnectionType
  ready: boolean
  showSyncUI: boolean
  syncIncomplete: boolean
  setDesired: (next: ConnectionType) => void
}

export function useConnectionMode(): UseConnectionMode {
  const { status } = useAuth()
  const phase = status?.walletSync.phase
  const walletId = status?.selectedWalletId ?? null
  const activeSyncWalletId = status?.walletSync.walletId ?? null
  const [desired, setDesiredState] = useState<ConnectionType>(readDesiredConnectionMode)
  const [ready, setReady] = useState(false)
  const completedSyncRef = useRef<CompletedSyncSnapshot | null>(null)

  useEffect(() => {
    if (activeSyncWalletId === null) {
      completedSyncRef.current = null
    } else if (status?.walletSync.phase === WalletSyncPhase.Synced) {
      completedSyncRef.current = {
        walletId: activeSyncWalletId,
        tipHeight: status.walletSync.tipHeight,
        cfilterScanHeight: status.walletSync.cfilterScanHeight,
      }
    } else if (completedSyncRef.current?.walletId !== activeSyncWalletId) {
      completedSyncRef.current = null
    }
  }, [
    activeSyncWalletId,
    status?.walletSync.cfilterScanHeight,
    status?.walletSync.phase,
    status?.walletSync.tipHeight,
  ])

  const phaseRef = useRef<WalletSyncPhase | undefined>(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    let cancelled = false
    API.getPreferences()
      .then(async (preferences) => {
        const applied = preferences.general.connectionType
        if (applied !== desired) {
          try {
            await API.setConnectionType(desired)
            invalidateAllAsyncCaches()
          } catch (error) {
            toast.error(`**Connection mode failed** Could not apply the selected mode. ${getErrorMessage(error)}`)
            setDesiredConnectionMode(applied)
            if (!cancelled) setDesiredState(applied)
          }
        }
        if (!cancelled) setReady(true)
      })
      .catch((error) => toast.error(`**Connection mode failed** Could not load connection settings. ${getErrorMessage(error)}`))
    return () => { cancelled = true }
  }, [desired])

  const autoStartedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!walletId) return

    // A sync running for a different wallet than the selected one is stale
    // (e.g. the user switched networks). Its phase/data belong to the old
    // wallet — stop it. Once it reports 'stopped' this effect re-runs and the
    // logic below decides whether to auto-start the newly-selected wallet.
    if (activeSyncWalletId && activeSyncWalletId !== walletId && !isWalletSyncInactive(phaseRef.current)) {
      autoStartedFor.current = null
      API.stopWalletSync().catch((error) => toast.error(`**Sync failed** Could not stop synchronization. ${getErrorMessage(error)}`))
      return
    }

    if (!isWalletSyncEnabled()) return

    if (autoStartedFor.current === walletId) return
    if (!isWalletSyncInactive(phaseRef.current)) {
      autoStartedFor.current = walletId
      return
    }
    autoStartedFor.current = walletId
    API.startWalletSync(walletId).catch((error) => toast.error(`**Sync failed** Could not start synchronization. ${getErrorMessage(error)}`))
  }, [walletId, phase, activeSyncWalletId])

  const pendingMode = useRef<ConnectionType | null>(null)
  const setDesired = useCallback((next: ConnectionType) => {
    if (next === desired || pendingMode.current !== null) return
    pendingMode.current = next
    API.setConnectionType(next)
      .then(() => {
        invalidateAllAsyncCaches()
        setDesiredConnectionMode(next)
        setDesiredState(next)
      })
      .catch((error) => toast.error(`**Connection mode failed** Could not switch connection mode. ${getErrorMessage(error)}`))
      .finally(() => { pendingMode.current = null })
  }, [desired])

  const syncIncomplete = isWalletSyncIncomplete(desired, phase)
  const showSyncUI = shouldShowWalletSyncUI(phase)
    && !shouldSuppressNearTipSyncProgress(status?.walletSync, completedSyncRef.current)

  return {
    desired,
    ready,
    showSyncUI,
    syncIncomplete,
    setDesired,
  }
}
