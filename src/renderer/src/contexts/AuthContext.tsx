import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { useNavigate } from 'react-router-dom'
import { AppStatus, WalletSyncStatus } from '@renderer/api/types'
import { APP_STATUS_POLL_MS, LOCK_FADE_MS } from '@renderer/constants'
import { toast } from '@renderer/components/ui/Toast'
import { getErrorMessage } from '@renderer/utils/error'

function isSameSync(a: WalletSyncStatus, b: WalletSyncStatus): boolean {
  return a.phase === b.phase
    && a.network === b.network
    && a.walletId === b.walletId
    && a.tipHeight === b.tipHeight
    && a.tipHash === b.tipHash
    && a.estimatedChainHeight === b.estimatedChainHeight
    && a.cfheadersHeight === b.cfheadersHeight
    && a.cfilterScanHeight === b.cfilterScanHeight
    && a.matchedBlocksPending === b.matchedBlocksPending
    && a.peerCount === b.peerCount
    && a.filterCapablePeerCount === b.filterCapablePeerCount
    && a.lockPeerCount === b.lockPeerCount
    && a.phaseEtaMs === b.phaseEtaMs
    && a.lastError === b.lastError
}

function isSameStatus(a: AppStatus | null, b: AppStatus): boolean {
  if (a === null) return false
  return a.ready === b.ready
    && a.selectedWalletId === b.selectedWalletId
    && a.network === b.network
    && a.connectionStatus === b.connectionStatus
    && isSameSync(a.walletSync, b.walletSync)
}

interface AuthContextValue {
  bootstrapped: boolean
  status: AppStatus | null
  isAuthenticated: boolean
  isLockingOut: boolean
  preselectedWalletId: string | null
  refreshStatus: () => Promise<void>
  loginSuccess: () => Promise<void>
  setPreselectedWalletId: (walletId: string | null) => void
  switchWallet: (walletId: string) => Promise<void>
  goToCreateWallet: () => void
  lock: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [bootstrapped, setBootstrapped] = useState(false)
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [lockingOut, setLockingOut] = useState(false)
  const [preselectedWalletId, setPreselectedWalletId] = useState<string | null>(null)
  const navigate = useNavigate()

  const refreshStatus = useCallback(async () => {
    const next = await API.getStatus() as AppStatus
    setStatus(prev => isSameStatus(prev, next) ? prev : next)
  }, [])

  useEffect(() => {
    refreshStatus()
      .catch(() => setStatus(null))
      .finally(() => setBootstrapped(true))
  }, [refreshStatus])

  useEffect(() => {
    const id = setInterval(() => {
      refreshStatus().catch(() => {})
    }, APP_STATUS_POLL_MS)
    return () => clearInterval(id)
  }, [refreshStatus])

  const loginSuccess = useCallback(async () => {
    await refreshStatus()
    setUnlocked(true)
    setPreselectedWalletId(null)
  }, [refreshStatus])

  const switchWallet = useCallback(async (walletId: string) => {
    if (!walletId) return
    setPreselectedWalletId(walletId)
    try {
      await API.selectWallet(walletId)
    } catch (error) {
      toast.error(`**Could not switch wallet** Try again. ${getErrorMessage(error)}`)
      return
    }
    setUnlocked(true)
    await refreshStatus()
    navigate('/')
  }, [navigate, refreshStatus])

  const goToCreateWallet = useCallback(() => {
    setPreselectedWalletId(null)
    navigate('/create-wallet')
  }, [navigate])

  const lock = useCallback(() => {
    if (lockingOut) return
    setLockingOut(true)
    setTimeout(() => {
      setUnlocked(false)
      setLockingOut(false)
      navigate('/')
    }, LOCK_FADE_MS)
  }, [lockingOut, navigate])

  const isAuthenticated = Boolean(status?.ready && status?.selectedWalletId && unlocked)

  const value = useMemo<AuthContextValue>(() => ({
    bootstrapped,
    status,
    isAuthenticated,
    isLockingOut: lockingOut,
    preselectedWalletId,
    refreshStatus,
    loginSuccess,
    setPreselectedWalletId,
    switchWallet,
    goToCreateWallet,
    lock
  }), [bootstrapped, status, isAuthenticated, unlocked, lockingOut, preselectedWalletId, refreshStatus, loginSuccess, switchWallet, goToCreateWallet, lock])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
