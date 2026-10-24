import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DASHPAY_PARAMS } from '@renderer/constants/dashPay'
import { useAuth } from '@renderer/contexts/AuthContext'
import { resolveActiveIdentity } from '@renderer/utils/dashPayIdentity'
import { readStoredIdentity, writeStoredIdentity } from '@renderer/utils/dashPayIdentityStorage'
import { dashPayReadiness } from '@renderer/utils/dashPayReadiness'
import { withParams } from '@renderer/utils/searchParams'
import { refreshIdentities, useIdentities } from './useIdentities'

export function useActiveIdentity() {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const { identities: unordered, loading, err } = useIdentities(walletId)
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get(DASHPAY_PARAMS.identity)

  const identities = useMemo(
    () => [...unordered].sort((a, b) => a.identityIndex - b.identityIndex),
    [unordered]
  )
  const resolution = useMemo(
    () => resolveActiveIdentity({
      identities,
      requested,
      stored: walletId === undefined ? null : readStoredIdentity(walletId),
    }),
    [identities, requested, walletId]
  )
  const identity = resolution.identity
  const readiness = useMemo(() => (identity == null ? null : dashPayReadiness(identity)), [identity])
  const resolved = identity?.identifier ?? null

  useEffect(() => {
    if (loading || err != null || resolved === requested) return
    setSearchParams(prev => withParams(prev, { [DASHPAY_PARAMS.identity]: resolved }), { replace: true })
  }, [loading, err, resolved, requested, setSearchParams])

  const select = useCallback((identifier: string) => {
    if (walletId !== undefined) writeStoredIdentity(walletId, identifier)
    setSearchParams(
      prev => withParams(prev, { [DASHPAY_PARAMS.identity]: identifier, [DASHPAY_PARAMS.contact]: null }),
      { replace: true }
    )
  }, [walletId, setSearchParams])

  const retry = useCallback(() => {
    if (walletId !== undefined) void refreshIdentities(walletId)
  }, [walletId])

  return {
    identities,
    identity,
    readiness,
    source: resolution.source,
    loading,
    err,
    retry,
    select,
  }
}
