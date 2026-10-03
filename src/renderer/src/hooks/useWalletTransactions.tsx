import { API } from '@renderer/api'
import { useMemo } from 'react'
import type { GetAddressesResponse, WalletHistory } from '@renderer/api/types'
import type { WalletTransactionOwnership } from '@renderer/types/WalletTransaction'
import type { IdentityApiDto } from './useIdentities'
import { EMPTY_WALLET_HISTORY } from '@renderer/constants/platformTransactions'
import { groupTransactionsByDay, mapWalletTransaction } from '@renderer/utils/walletTransactions'
import { platformInternalTransferFee } from '@renderer/utils/platformTransactions'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export type { WalletTxDto, WalletTxItem } from '@renderer/types/WalletTransaction'

export async function fetchTransactionOwnership(walletId: string): Promise<WalletTransactionOwnership> {
  const ownership: WalletTransactionOwnership = {
    walletId, core: new Set(), platform: new Set(), identities: new Set(), shielded: new Set(),
  }
  const [core, platform, identities, shielded] = await Promise.allSettled([
    API.getAddresses(walletId).then(data => data as GetAddressesResponse | null),
    API.getPlatformAddresses(walletId),
    API.getIdentities(walletId).then(data => (data ?? []) as IdentityApiDto[]),
    API.getShieldedAddresses(walletId),
  ])
  if (core.status === 'fulfilled' && core.value) {
    for (const address of [...core.value.receiving, ...core.value.change]) {
      if (address.walletId === walletId && address.address) ownership.core.add(address.address)
    }
  }
  if (platform.status === 'fulfilled') {
    for (const address of platform.value) if (address.platformAddress) ownership.platform.add(address.platformAddress)
  }
  if (identities.status === 'fulfilled') {
    for (const identity of identities.value) if (identity.identifier) ownership.identities.add(identity.identifier)
  }
  if (shielded.status === 'fulfilled') {
    for (const address of shielded.value ?? []) if (address) ownership.shielded.add(address)
  }
  return ownership
}

export function useWalletTransactions(walletId: string | undefined, refreshIntervalMs?: number) {
  const { data: history, loading, err } = useAsyncWithCache<WalletHistory>(
    'transactions',
    walletId,
    () => API.getTransactions(walletId!),
    EMPTY_WALLET_HISTORY,
    { errorMessage: 'Failed to load transactions', refreshIntervalMs }
  )
  const emptyOwnership = useMemo<WalletTransactionOwnership>(() => ({
    walletId: null, core: new Set(), platform: new Set(), identities: new Set(), shielded: new Set(),
  }), [])
  const { data: loadedOwnership } = useAsyncWithCache(
    'transaction-ownership',
    walletId,
    () => fetchTransactionOwnership(walletId!),
    emptyOwnership,
    { refreshIntervalMs }
  )
  const ownership = loadedOwnership.walletId === walletId ? loadedOwnership : emptyOwnership
  const groups = useMemo(() => groupTransactionsByDay(history.core.map(transaction =>
    mapWalletTransaction(transaction, ownership.core))), [history.core, ownership])
  const platform = useMemo(() => history.platform.map(transaction => ({
    ...transaction,
    internalTransferFeeCredits: platformInternalTransferFee(transaction, ownership) ?? undefined,
  })), [history.platform, ownership])
  return { groups, platform, platformFailed: history.platformFailed, loading, err }
}

export function prefetchTransactions(walletId: string): Promise<void> {
  return prefetchAsyncCache('transactions', walletId, () => API.getTransactions(walletId))
}

export function refreshTransactions(walletId: string): Promise<void> {
  invalidateAsyncCache('transactions', walletId)
  invalidateAsyncCache('transaction-ownership', walletId)
  return prefetchTransactions(walletId)
}
