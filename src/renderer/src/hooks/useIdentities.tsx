import { API } from '@renderer/api'
import { useAsyncWithCache } from './useAsyncWithCache'

export type IdentityApiDto = {
  identityIndex: number
  identifier: string
  alias: string | null
  balance: {
    amount: bigint
    usdAmount: string
  }
  derivationPath: string
}

export function useIdentities(walletId?: string) {
  const { data: identities, loading, err } = useAsyncWithCache<IdentityApiDto[]>(
    'identities',
    walletId,
    () => API.getIdentities(walletId!).then((d) => (d ?? []) as IdentityApiDto[]),
    [],
    { errorMessage: 'Failed to load identities' }
  )
  return { identities, loading, err }
}
