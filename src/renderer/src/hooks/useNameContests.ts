import { MasternodePreviewAPI } from '@renderer/api/preview/MasternodePreviewAPI'
import { masternodePreviewCacheKey } from '@renderer/api/preview/previewStore'
import { MASTERNODE_CACHE_NAMESPACES, MASTERNODE_LOAD_ERRORS } from '@renderer/constants/masternodes'
import type { NameContestDto } from '@renderer/types/Masternodes'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'
import { useMasternodePreviewPreset } from './useMasternodePreviewPreset'

export function useNameContests(walletId: string | undefined) {
  const { preset } = useMasternodePreviewPreset()
  const { data, loading, err } = useAsyncWithCache<NameContestDto[]>(
    MASTERNODE_CACHE_NAMESPACES.contests,
    walletId === undefined ? undefined : masternodePreviewCacheKey(walletId, preset),
    () => MasternodePreviewAPI.getNameContests(walletId!),
    [],
    { errorMessage: MASTERNODE_LOAD_ERRORS.contests }
  )
  return { contests: data, loading, err }
}

export function refreshNameContests(walletId: string): Promise<void> {
  const key = masternodePreviewCacheKey(walletId)
  invalidateAsyncCache(MASTERNODE_CACHE_NAMESPACES.contests, key)
  return prefetchAsyncCache(MASTERNODE_CACHE_NAMESPACES.contests, key, () => MasternodePreviewAPI.getNameContests(walletId))
}
