import { useMemo } from 'react'
import { API } from '@renderer/api'
import { GetAddressesResponse, WalletAddressDto } from '@renderer/api/types'
import { useAsyncWithCache } from './useAsyncWithCache'

type AddressesData = { receiving: WalletAddressDto[]; change: WalletAddressDto[] }

export function useAdresses(walletId: string | undefined) {
  const initial = useMemo<AddressesData>(() => ({ receiving: [], change: [] }), [])
  const { data, loading, err } = useAsyncWithCache<AddressesData>(
    'addresses',
    walletId,
    () => API.getAddresses(walletId!).then((d) => {
      const body = d as GetAddressesResponse
      return { receiving: body.receiving ?? [], change: body.change ?? [] }
    }),
    initial,
    { errorMessage: 'Failed to load addresses' }
  )
  return { receiving: data.receiving, change: data.change, loading, err }
}
