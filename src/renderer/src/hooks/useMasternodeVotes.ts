import { MasternodePreviewAPI } from '@renderer/api/preview/MasternodePreviewAPI'
import { masternodePreviewCacheKey } from '@renderer/api/preview/previewStore'
import { MASTERNODE_CACHE_NAMESPACES, MASTERNODE_LOAD_ERRORS } from '@renderer/constants/masternodes'
import type { MasternodeVoteDto } from '@renderer/types/Masternodes'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'
import { useMasternodePreviewPreset } from './useMasternodePreviewPreset'

export function useMasternodeVotes(walletId: string | undefined) {
  const { preset } = useMasternodePreviewPreset()
  const { data, loading, err } = useAsyncWithCache<MasternodeVoteDto[]>(
    MASTERNODE_CACHE_NAMESPACES.votes,
    walletId === undefined ? undefined : masternodePreviewCacheKey(walletId, preset),
    () => MasternodePreviewAPI.getMasternodeVotes(walletId!),
    [],
    { errorMessage: MASTERNODE_LOAD_ERRORS.votes }
  )
  return { votes: data, loading, err }
}

export function refreshMasternodeVotes(walletId: string): Promise<void> {
  const key = masternodePreviewCacheKey(walletId)
  invalidateAsyncCache(MASTERNODE_CACHE_NAMESPACES.votes, key)
  return prefetchAsyncCache(MASTERNODE_CACHE_NAMESPACES.votes, key, () => MasternodePreviewAPI.getMasternodeVotes(walletId))
}
