import { useMemo } from 'react'
import { API } from '@renderer/api'
import { BALANCE_REFRESH_MS } from '@renderer/constants'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export type WalletBalanceData = {
  dash: { amount: bigint; usdAmount: string }
  credits: { amount: bigint; usdAmount: string }
}

const fetchBalance = (walletId: string): Promise<WalletBalanceData> =>
  API.getWalletBalance(walletId).then((d) => {
    const raw = d as WalletBalanceData
    return {
      dash: { amount: BigInt(raw?.dash?.amount ?? 0n), usdAmount: raw?.dash?.usdAmount ?? '0' },
      credits: { amount: BigInt(raw?.credits?.amount ?? 0n), usdAmount: raw?.credits?.usdAmount ?? '0' }
    }
  })

export function useWalletBalance(walletId: string | undefined) {
  const initial = useMemo<WalletBalanceData>(
    () => ({ dash: { amount: 0n, usdAmount: '0' }, credits: { amount: 0n, usdAmount: '0' } }),
    []
  )
  const { data, loading, err } = useAsyncWithCache<WalletBalanceData>(
    'balance',
    walletId,
    () => fetchBalance(walletId!),
    initial,
    { errorMessage: 'Failed to load balance', refreshIntervalMs: BALANCE_REFRESH_MS }
  )
  return { balance: data, loading, err }
}

export function prefetchBalance(walletId: string): Promise<void> {
  return prefetchAsyncCache('balance', walletId, () => fetchBalance(walletId))
}

export function refreshBalance(walletId: string): Promise<void> {
  invalidateAsyncCache('balance', walletId)
  return prefetchBalance(walletId)
}
