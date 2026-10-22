import { useMemo } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { walletAddressSet } from '@renderer/utils/addressBook'
import { useAdresses } from './useAdresses'
import { useIdentities } from './useIdentities'
import { usePlatformAddresses } from './usePlatformAddresses'
import { useSavedShieldedAddresses } from './useSavedShieldedAddresses'
import { useShieldedSyncState } from './useShielded'

export function useWalletAddressSet(): Set<string> {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const { receiving, change } = useAdresses(walletId)
  const { platformAddresses } = usePlatformAddresses(walletId)
  const { identities } = useIdentities(walletId)
  const sync = useShieldedSyncState(walletId)
  const shielded = useSavedShieldedAddresses(true, sync.phase)

  return useMemo(() => walletAddressSet({
    receiving, change, platformAddresses, identities, shieldedAddresses: shielded.addresses, shieldedNotes: sync.notes,
  }), [receiving, change, platformAddresses, identities, shielded.addresses, sync.notes])
}
