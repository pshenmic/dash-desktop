import { MasternodePreviewAPI } from '@renderer/api/preview/MasternodePreviewAPI'
import { masternodePreviewCacheKey } from '@renderer/api/preview/previewStore'
import { MASTERNODE_CACHE_NAMESPACES, MASTERNODE_LOAD_ERRORS } from '@renderer/constants/masternodes'
import type { MasternodeDto } from '@renderer/types/Masternodes'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'
import { useMasternodePreviewPreset } from './useMasternodePreviewPreset'

export function useMasternodes(walletId: string | undefined) {
  const { preset } = useMasternodePreviewPreset()
  const { data, loading, err } = useAsyncWithCache<MasternodeDto[]>(
    MASTERNODE_CACHE_NAMESPACES.nodes,
    walletId === undefined ? undefined : masternodePreviewCacheKey(walletId, preset),
    () => MasternodePreviewAPI.getMasternodes(walletId!),
    [],
    { errorMessage: MASTERNODE_LOAD_ERRORS.nodes }
  )
  return { nodes: data, loading, err }
}

export function refreshMasternodes(walletId: string): Promise<void> {
  const key = masternodePreviewCacheKey(walletId)
  invalidateAsyncCache(MASTERNODE_CACHE_NAMESPACES.nodes, key)
  return prefetchAsyncCache(MASTERNODE_CACHE_NAMESPACES.nodes, key, () => MasternodePreviewAPI.getMasternodes(walletId))
}
