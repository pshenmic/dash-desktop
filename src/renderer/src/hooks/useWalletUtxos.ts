import { useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import type { GetAddressesResponse } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import type { WalletUtxosRequest, WalletUtxosResult, WalletUtxosSnapshot } from '@renderer/types/CoinControl'
import { getErrorMessage } from '@renderer/utils/error'
import { isWalletSyncInactive } from '@renderer/utils/walletSync'
import { localWalletUtxos } from '@renderer/utils/localWalletUtxos'

export function useWalletUtxos(refreshKey = 0): WalletUtxosResult {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const { syncIncomplete, desired: connectionType } = useConnectionModeContext()
  const localSnapshot = connectionType === 'p2p' && isWalletSyncInactive(status?.walletSync?.phase)
  const [snapshot, setSnapshot] = useState<WalletUtxosSnapshot | null>(null)
  const [reload, setReload] = useState(0)
  const request = useMemo<WalletUtxosRequest>(
    () => ({walletId, syncIncomplete, localSnapshot, connectionType, refreshKey, reload}),
    [walletId, syncIncomplete, localSnapshot, connectionType, refreshKey, reload],
  )

  useEffect(() => {
    const requestWalletId = request.walletId
    if (!requestWalletId || (request.syncIncomplete && !request.localSnapshot)) return
    let cancelled = false
    const load = request.localSnapshot
      ? Promise.all([API.getTransactions(requestWalletId), API.getAddresses(requestWalletId)])
        .then(([transactions, addresses]) => localWalletUtxos(requestWalletId, transactions, addresses as GetAddressesResponse))
      : API.getUtxos(requestWalletId)
    load
      .then(utxos => {
        if (!cancelled) setSnapshot({request, utxos, error: null})
      })
      .catch(cause => {
        if (!cancelled) setSnapshot(previous => ({
          request,
          utxos: previous?.request.walletId === request.walletId
            && previous.request.connectionType === request.connectionType ? previous.utxos : [],
          error: `Could not load spendable UTXOs. ${getErrorMessage(cause)}`,
        }))
      })
    return () => { cancelled = true }
  }, [request])

  const utxos = walletId != null && snapshot?.request.walletId === walletId
    && snapshot.request.connectionType === connectionType ? snapshot.utxos : []
  // A sync transition must block submission before its fetch effect runs.
  const current = snapshot?.request === request
  const loading = walletId != null && ((syncIncomplete && !localSnapshot) || !current)
  const error = current ? snapshot.error : null
  return {utxos, loading, localSnapshot, error, retry: () => setReload(current => current + 1)}
}
