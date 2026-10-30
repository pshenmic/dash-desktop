import { API } from '@renderer/api'
import { DASHPAY_CACHE_NAMESPACES } from '@renderer/constants/dashPay'
import { invalidateAsyncCachePrefix } from './useAsyncWithCache'
import { refreshDashPayUsernames } from './useDashPayUsernames'
import { refreshDashPayContacts } from './useDashPayContacts'

const inflight = new Map<string, Promise<void>>()

export function refreshDashPay(walletId: string): Promise<void> {
  const running = inflight.get(walletId)
  if (running !== undefined) return running

  const run = (async (): Promise<void> => {
    try {
      await API.refreshDashPay(walletId)
      invalidateAsyncCachePrefix(DASHPAY_CACHE_NAMESPACES.payments, `${walletId}:`)
      await Promise.all([refreshDashPayContacts(walletId), refreshDashPayUsernames(walletId)])
    } finally {
      inflight.delete(walletId)
    }
  })()
  inflight.set(walletId, run)
  return run
}
