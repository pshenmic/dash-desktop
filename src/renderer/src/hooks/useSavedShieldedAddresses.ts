import { useEffect, useState } from 'react'
import { API } from '@renderer/api'
import { useAuth } from '@renderer/contexts/AuthContext'

export function useSavedShieldedAddresses(enabled: boolean, refreshKey: unknown) {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId
  const [addresses, setAddresses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => { setAddresses([]) }, [walletId])

  useEffect(() => {
    if (!enabled || !walletId) return
    let cancelled = false
    setLoading(true)
    setError(false)
    API.getShieldedAddresses(walletId)
      .then(addresses => { if (!cancelled) setAddresses(addresses ?? []) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [enabled, walletId, refreshKey, retryKey])

  return { addresses, loading, error, retry: () => setRetryKey(key => key + 1) }
}
