import { useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import type { WalletUtxosRequest, WalletUtxosResult, WalletUtxosSnapshot } from '@renderer/types/CoinControl'
import { getErrorMessage } from '@renderer/utils/error'

export function useWalletUtxos(refreshKey = 0): WalletUtxosResult {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const { syncIncomplete, desired: connectionType } = useConnectionModeContext()
  const [snapshot, setSnapshot] = useState<WalletUtxosSnapshot | null>(null)
  const [reload, setReload] = useState(0)
  const request = useMemo<WalletUtxosRequest>(
    () => ({walletId, syncIncomplete, connectionType, refreshKey, reload}),
    [walletId, syncIncomplete, connectionType, refreshKey, reload],
  )

  useEffect(() => {
    if (!request.walletId || request.syncIncomplete) return
    let cancelled = false
    API.getUtxos(request.walletId)
      .then(utxos => {
        if (!cancelled) setSnapshot({request, utxos, error: null})
      })
      .catch(cause => {
        if (!cancelled) setSnapshot(previous => ({
          request,
          utxos: previous?.request.walletId === request.walletId ? previous.utxos : [],
          error: `Could not load spendable UTXOs. ${getErrorMessage(cause)}`,
        }))
      })
    return () => { cancelled = true }
  }, [request])

  const utxos = walletId != null && snapshot?.request.walletId === walletId ? snapshot.utxos : []
  // A sync transition must block submission before its fetch effect runs.
  const current = snapshot?.request === request
  const loading = walletId != null && (syncIncomplete || !current)
  const error = current ? snapshot.error : null
  return {utxos, loading, error, retry: () => setReload(current => current + 1)}
}
