import { useEffect, useState } from 'react'
import { API } from '@renderer/api'
import { OperationFee, OperationFeeParams } from '@renderer/api/types'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { NO_OPERATION_FEE, TRANSITION_FEE_DEBOUNCE_MS, TRANSITION_FEE_ERROR } from '@renderer/constants'
import { invalidateAsyncCache, useAsyncWithCache } from './useAsyncWithCache'
import { operationFeeRequest } from '@renderer/utils/operationFee'

// Core quotes need the output count; other routes may need parsed destinations.
export function useOperationFee(
  walletId: string | null,
  operation: TransferOperation | null,
  params: OperationFeeParams,
): OperationFee & { loading: boolean; err: string | null; retry: () => void } {
  const pending = operationFeeRequest(walletId, operation, params)

  const [settled, setSettled] = useState<typeof pending>(null)

  useEffect(() => {
    if (pending === null) {
      setSettled(null)
      return
    }
    const timer = setTimeout(() => setSettled(pending), TRANSITION_FEE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [pending?.key])

  const quote = useAsyncWithCache<{ key: string; maxKey: string; fee: OperationFee } | null>(
    'operation-fee',
    settled?.key,
    async () => ({
      key: settled!.key,
      maxKey: settled!.maxKey,
      fee: await API.estimateFee(settled!.walletId, settled!.operation, settled!.feeParams),
    }),
    null,
    { errorMessage: TRANSITION_FEE_ERROR },
  )

  const loading = pending !== null && (quote.loading || pending.key !== settled?.key || (!quote.err && pending.key !== quote.data?.key))
  const fee = pending == null ? NO_OPERATION_FEE : quote.data?.fee ?? NO_OPERATION_FEE
  // Core's maximum depends on the funding set and output count, not the typed amount.
  const maxDuffs = operation === TransferOperation.CoreSend && pending?.maxKey !== quote.data?.maxKey
    ? null : fee.maxDuffs

  const retry = (): void => {
    if (settled) invalidateAsyncCache('operation-fee', settled.key)
  }
  return { ...fee, maxDuffs, loading, err: quote.err, retry }
}
