import { useEffect, useState } from 'react'
import { API } from '@renderer/api'
import type { SelectableUtxo } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import type { WalletUtxosResult } from '@renderer/types/CoinControl'
import { getErrorMessage } from '@renderer/utils/error'

export function useWalletUtxos(refreshKey = 0): WalletUtxosResult {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const { syncIncomplete } = useConnectionModeContext()
  const [utxos, setUtxos] = useState<SelectableUtxo[]>([])
  const [loading, setLoading] = useState(walletId != null && !syncIncomplete)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setUtxos([])
    setError(null)
    if (!walletId || syncIncomplete) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    API.getUtxos(walletId)
      .then(loaded => { if (!cancelled) setUtxos(loaded) })
      .catch(cause => {
        if (!cancelled) setError(`Could not load spendable UTXOs. ${getErrorMessage(cause)}`)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [walletId, syncIncomplete, refreshKey, reload])

  return {utxos, loading, error, retry: () => setReload(current => current + 1)}
}
