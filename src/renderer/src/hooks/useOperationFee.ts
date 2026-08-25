import { useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { OperationFee, OperationFeeParams } from '@renderer/api/types'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { NO_OPERATION_FEE, TRANSITION_FEE_DEBOUNCE_MS, TRANSITION_FEE_ERROR } from '@renderer/constants'
import { useAsyncWithCache } from './useAsyncWithCache'

// Every fee comes from the backend. This only decides when to ask: not before
// the destination parses, and not on every keystroke.
export function useOperationFee(
  walletId: string | null,
  operation: TransferOperation | null,
  params: OperationFeeParams,
): OperationFee & { loading: boolean; err: string | null } {
  const { destinationValid, amountCredits, recipient, sourceAddress, identityId, noteIndexes } = params

  const pending = useMemo(
    () => {
      if (walletId === null || operation === null || !destinationValid) return null
      const feeParams = { amountCredits, recipient, sourceAddress, identityId, noteIndexes }
      return { feeParams, key: `${walletId}:${operation}:${amountCredits}:${recipient}:${sourceAddress}:${identityId}:${noteIndexes?.join(',')}` }
    },
    [walletId, operation, destinationValid, amountCredits, recipient, sourceAddress, identityId, noteIndexes?.join(',')],
  )

  const [settled, setSettled] = useState<typeof pending>(null)

  useEffect(() => {
    if (pending === null) {
      setSettled(null)
      return
    }
    const timer = setTimeout(() => setSettled(pending), TRANSITION_FEE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [pending])

  const quote = useAsyncWithCache<OperationFee>(
    'operation-fee',
    settled?.key,
    () => API.estimateFee(walletId!, operation!, settled!.feeParams),
    NO_OPERATION_FEE,
    { errorMessage: TRANSITION_FEE_ERROR },
  )

  const debouncing = pending !== null && pending.key !== settled?.key

  return { ...quote.data, loading: quote.loading || debouncing, err: quote.err }
}
