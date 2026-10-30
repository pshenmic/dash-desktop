import { API } from '@renderer/api'
import type { DashPayPaymentDto } from '@renderer/api/types'
import { DASHPAY_CACHE_NAMESPACES, DASHPAY_LOAD_ERRORS } from '@renderer/constants/dashPay'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export function useDashPayPayments(walletId: string | undefined, identifier: string | undefined, contactId: string | undefined) {
  const key = walletId !== undefined && identifier !== undefined && contactId !== undefined
    ? `${walletId}:${identifier}:${contactId}`
    : undefined
  const { data, loading, err } = useAsyncWithCache<DashPayPaymentDto[]>(
    DASHPAY_CACHE_NAMESPACES.payments,
    key,
    () => API.getDashPayPayments(walletId!, identifier!, contactId!),
    [],
    { errorMessage: DASHPAY_LOAD_ERRORS.payments }
  )
  return { payments: data, loading, err }
}

export function refreshDashPayPayments(walletId: string, identifier: string, contactId: string): Promise<void> {
  const key = `${walletId}:${identifier}:${contactId}`
  invalidateAsyncCache(DASHPAY_CACHE_NAMESPACES.payments, key)
  return prefetchAsyncCache(DASHPAY_CACHE_NAMESPACES.payments, key, () => API.getDashPayPayments(walletId, identifier, contactId))
}
