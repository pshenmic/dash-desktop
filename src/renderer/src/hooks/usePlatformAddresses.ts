import { API } from '@renderer/api'
import { PlatformAddressDto } from '@renderer/api/types'
import { prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

const fetchPlatformAddresses = (walletId: string): Promise<PlatformAddressDto[]> =>
  API.getPlatformAddresses(walletId).then((d) => (d ?? []) as PlatformAddressDto[])

export function usePlatformAddresses(walletId: string | undefined) {
  const { data, loading, err } = useAsyncWithCache<PlatformAddressDto[]>(
    'platformAddresses',
    walletId,
    () => fetchPlatformAddresses(walletId!),
    [],
    { errorMessage: 'Failed to load platform addresses' }
  )
  return { platformAddresses: data, loading, err }
}

export function prefetchPlatformAddresses(walletId: string): Promise<void> {
  return prefetchAsyncCache('platformAddresses', walletId, () => fetchPlatformAddresses(walletId))
}
