import { API } from '@renderer/api'
import { WalletUtxoDto } from '@renderer/api/types'
import { utxosPage } from '@renderer/constants'
import { prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

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
  return { utxos: data, loading, err }
}

export function prefetchUtxos(walletId: string): Promise<void> {
  return prefetchAsyncCache('utxos', walletId, () => fetchUtxos(walletId))
}
