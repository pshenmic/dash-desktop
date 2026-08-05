import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import { ConnectionType, WalletSyncPhase } from '@renderer/api/types'
import { toast } from '@renderer/components/ui/Toast'
import { CONNECTION_SWITCH_FAILED } from '@renderer/constants/connection'
import { useAuth } from '@renderer/contexts/AuthContext'
import { ProviderCacheNamespace } from '@renderer/enums/ProviderCacheNamespace'
import { connectionGate } from '@renderer/utils/connectionGate'
import { invalidateNamespaces } from './useAsyncWithCache'

function isP2pInactive(phase: WalletSyncPhase | undefined): boolean {
  return phase === undefined || phase === WalletSyncPhase.Stopped || phase === WalletSyncPhase.Idle
}

export interface UseConnectionMode {
  connectionType: ConnectionType | null
  showSyncUI: boolean
  actionsGated: boolean
  dataIncomplete: boolean
  setConnectionType: (next: ConnectionType) => void
}

export function useConnectionMode(): UseConnectionMode {
  const { status } = useAuth()
  const phase = status?.walletSync.phase
  const walletId = status?.selectedWalletId ?? null
  const activeSyncWalletId = status?.walletSync.walletId ?? null
  const [connectionType, setConnectionTypeState] = useState<ConnectionType | null>(null)

  const phaseRef = useRef<WalletSyncPhase | undefined>(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    API.getPreferences()
      .then(preferences => setConnectionTypeState(preferences.general.connectionType))
      .catch(err => console.error('getPreferences failed', err))
  }, [])

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

    if (connectionType !== 'p2p') return
    if (autoStartedFor.current === walletId) return
    autoStartedFor.current = walletId
    if (!isP2pInactive(phaseRef.current)) return
    API.startWalletSync(walletId).catch(err => console.error('auto startWalletSync failed', err))
  }, [walletId, connectionType, phase, activeSyncWalletId])

  const setConnectionType = useCallback((next: ConnectionType) => {
    if (next === connectionType) return
    API.setConnectionType(next)
      .then(result => {
        if (!result.success) throw new Error(result.errorMessage ?? CONNECTION_SWITCH_FAILED)
        setConnectionTypeState(next)
        invalidateNamespaces(Object.values(ProviderCacheNamespace))
        if (next === 'p2p' && walletId && isP2pInactive(phaseRef.current)) {
          API.startWalletSync(walletId).catch(err => console.error('startWalletSync failed', err))
        } else if (next === 'rpc' && !isP2pInactive(phaseRef.current)) {
          API.stopWalletSync().catch(err => console.error('stopWalletSync failed', err))
        }
      })
      .catch(err => {
        console.error('setConnectionType failed', err)
        toast.error(CONNECTION_SWITCH_FAILED)
      })
  }, [walletId, connectionType])

  const gate = useMemo(() => connectionGate(connectionType, phase), [connectionType, phase])

  return {
    connectionType,
    showSyncUI: connectionType === 'p2p',
    actionsGated: gate.actionsGated,
    dataIncomplete: gate.dataIncomplete,
    setConnectionType,
  }
}
