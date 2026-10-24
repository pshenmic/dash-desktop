import { useEffect, useState } from 'react'
import { API } from '@renderer/api'
import { useAuth } from '@renderer/contexts/AuthContext'
import { getErrorMessage } from '@renderer/utils/error'

export function useSavedShieldedAddresses(enabled: boolean, refreshKey: unknown) {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId
  const [addresses, setAddresses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => { setAddresses([]) }, [walletId])

  useEffect(() => {
    if (!enabled || !walletId) return
    let cancelled = false
    setLoading(true)
    setErrorMessage(null)
    API.getShieldedAddresses(walletId)
      .then(addresses => { if (!cancelled) setAddresses(addresses ?? []) })
      .catch(error => { if (!cancelled) setErrorMessage(getErrorMessage(error)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [enabled, walletId, refreshKey, retryKey])

  return { addresses, loading, error: errorMessage != null, errorMessage, retry: () => setRetryKey(key => key + 1) }
}
