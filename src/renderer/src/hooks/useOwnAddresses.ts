import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { addressKey } from '../utils/addressBook'
import { useAdresses } from './useAdresses'
import { useIdentities } from './useIdentities'
import { usePlatformAddresses } from './usePlatformAddresses'
import { useSavedShieldedAddresses } from './useSavedShieldedAddresses'
import { useShieldedSyncState } from './useShielded'

export function useOwnAddresses(refreshKey?: unknown) {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const core = useAdresses(walletId)
  const platform = usePlatformAddresses(walletId)
  const identities = useIdentities(walletId)
  const shielded = useSavedShieldedAddresses(true, refreshKey)
  const sync = useShieldedSyncState(walletId)
  return useMemo(() => new Set([
    ...(!core.loading && !core.err ? [...core.receiving, ...core.change].map(item => item.address) : []),
    ...(!platform.loading && !platform.err ? platform.platformAddresses.map(item => item.platformAddress) : []),
    ...(!identities.loading && !identities.err ? identities.identities.map(item => item.identifier) : []),
    ...(!shielded.loading && !shielded.error ? shielded.addresses : []),
    ...sync.notes.map(note => note.address).filter((address): address is string => !!address),
  ].map(addressKey)), [core.receiving, core.change, core.loading, core.err, platform.platformAddresses, platform.loading, platform.err, identities.identities, identities.loading, identities.err, shielded.addresses, shielded.loading, shielded.error, sync.notes])
}
