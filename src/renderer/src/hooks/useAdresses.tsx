import { useMemo } from 'react'
import { API } from '@renderer/api'
import { GetAddressesResponse, WalletAddressDto } from '@renderer/api/types'
import { prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

type AddressesData = { receiving: WalletAddressDto[]; change: WalletAddressDto[] }

const fetchAddresses = (walletId: string): Promise<AddressesData> =>
  API.getAddresses(walletId).then((d) => {
    const body = d as GetAddressesResponse
    return { receiving: body.receiving ?? [], change: body.change ?? [] }
  })

export function useAdresses(walletId: string | undefined) {
  const initial = useMemo<AddressesData>(() => ({ receiving: [], change: [] }), [])
  const { data, loading, err } = useAsyncWithCache<AddressesData>(
    'addresses',
    walletId,
    () => fetchAddresses(walletId!),
    initial,
    { errorMessage: 'Failed to load addresses' }
  )
  return { receiving: data.receiving, change: data.change, loading, err }
}

export function prefetchAddresses(walletId: string): Promise<void> {
  return prefetchAsyncCache('addresses', walletId, () => fetchAddresses(walletId))
}
