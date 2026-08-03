import { useCallback } from 'react'
import { API } from '@renderer/api'
import { WalletUtxoDto } from '@renderer/api/types'
import { toast } from '@renderer/components/ui/Toast'
import { utxosPage } from '@renderer/constants'
import { prefetchAsyncCache, updateAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

const fetchUtxos = (walletId: string): Promise<WalletUtxoDto[]> =>
  API.getUtxosDetailed(walletId) as Promise<WalletUtxoDto[]>

const EMPTY_UTXOS: WalletUtxoDto[] = []

export function useUtxos(walletId: string | undefined) {
  const { data, loading, err } = useAsyncWithCache<WalletUtxoDto[]>(
    'utxos',
    walletId,
    () => fetchUtxos(walletId!),
    EMPTY_UTXOS,
    { errorMessage: utxosPage.errorMessage }
  )

  const setLabel = useCallback(
    async (txid: string, vout: number, label: string | null): Promise<void> => {
      if (walletId === undefined) return
      try {
        const res = await API.setUtxoLabel(walletId, txid, vout, label)
        if (!res.success) {
          toast.error(`**${utxosPage.labelSaveFailed}** ${res.errorMessage ?? ''}`.trim())
          return
        }
        updateAsyncCache<WalletUtxoDto[]>('utxos', walletId, (prev) =>
          prev.map((utxo) => (utxo.txid === txid && utxo.vout === vout ? { ...utxo, label } : utxo))
        )
      } catch (e) {
        console.error('[utxos] label save failed:', e)
        toast.error(`**${utxosPage.labelSaveFailed}**`)
      }
    },
    [walletId]
  )

  return { utxos: data, loading, err, setLabel }
}

export function prefetchUtxos(walletId: string): Promise<void> {
  return prefetchAsyncCache('utxos', walletId, () => fetchUtxos(walletId))
}
