import { API } from '@renderer/api'
import type { DashPayContactDto } from '@renderer/api/types'
import { DASHPAY_CACHE_NAMESPACES, DASHPAY_LOAD_ERRORS } from '@renderer/constants/dashPay'
import { invalidateAsyncCache, prefetchAsyncCache, setAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export function useDashPayContacts(walletId: string | undefined) {
  const { data, loading, err } = useAsyncWithCache<DashPayContactDto[]>(
    DASHPAY_CACHE_NAMESPACES.contacts,
    walletId,
    () => API.getDashPayContacts(walletId!),
    [],
    { errorMessage: DASHPAY_LOAD_ERRORS.contacts }
  )
  return { contacts: data, loading, err }
}

export function refreshDashPayContacts(walletId: string): Promise<void> {
  invalidateAsyncCache(DASHPAY_CACHE_NAMESPACES.contacts, walletId)
  return prefetchAsyncCache(DASHPAY_CACHE_NAMESPACES.contacts, walletId, () => API.getDashPayContacts(walletId))
}

export function setDashPayContactsCache(walletId: string, contacts: DashPayContactDto[]): void {
  setAsyncCache(DASHPAY_CACHE_NAMESPACES.contacts, walletId, contacts)
}
