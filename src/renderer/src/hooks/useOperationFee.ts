import { useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { Network, OperationFeeParams } from '@renderer/api/types'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import {
  SelectableNote,
  SpendFeeForCount,
  maxSpendableCredits,
  selectSpendNotes,
} from '@renderer/utils/shieldedNoteSelection'
import { feeQueryFor, feeQueryKey } from '@renderer/utils/transitionFeeQuery'
import { operationInfo } from '@renderer/utils/transferMatrix'
import {
  FEE_QUOTE_MIN_NOTE_COUNT,
  MAX_SPEND_NOTES,
  TRANSITION_FEE_DEBOUNCE_MS,
  TRANSITION_FEE_ERROR,
} from '@renderer/constants'
import { useAsyncWithCache } from './useAsyncWithCache'

export function useOperationFee(
  network: Network | null,
  operation: TransferOperation | null,
  params: OperationFeeParams,
): {
  feeCredits: bigint | null
  maxPerTx: bigint | null
  loading: boolean
  err: string | null
} {
  const { notes, amountCredits, destinationValid, recipient, source, identityId } = params
  const spendKind = operation === null ? null : operationInfo(operation).spendKind

  const minimums = useAsyncWithCache<bigint[] | null>(
    'transition-fee-minimums',
    network !== null && spendKind !== null ? `${network}:${spendKind}` : undefined,
    () => Promise.all(Array.from({ length: MAX_SPEND_NOTES }, (_, i) =>
      API.estimateTransitionFee(network!, {
        kind: 'shieldedSpend',
        spendKind: spendKind!,
        noteCount: i + FEE_QUOTE_MIN_NOTE_COUNT,
        recipients: [],
      }).then(quote => quote.minFeeCredits))),
    null,
    { errorMessage: TRANSITION_FEE_ERROR },
  )

  const pending = useMemo(
    () => {
      const query = feeQueryFor(operation, { destinationValid, recipient, amountCredits, source, identityId })
      return network === null || query === null ? null : { query, key: `${network}:${feeQueryKey(query)}` }
    },
    [network, operation, destinationValid, recipient, amountCredits, source?.platformAddress, source?.nonce, identityId],
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

  const quote = useAsyncWithCache<bigint | null>(
    'transition-fee-quote',
    settled?.key,
    () => API.estimateTransitionFee(network!, settled!.query).then(q => q.totalFeeCredits),
    null,
    { errorMessage: TRANSITION_FEE_ERROR },
  )

  const feeForCount = useMemo<SpendFeeForCount | null>(
    () => {
      const minByCount = minimums.data
      if (minByCount === null) return null
      return numSpends => minByCount[Math.max(numSpends, FEE_QUOTE_MIN_NOTE_COUNT) - FEE_QUOTE_MIN_NOTE_COUNT]
    },
    [minimums.data],
  )

  const candidates = useMemo<SelectableNote[] | null>(
    () => (spendKind === null || notes === null
      ? null
      : notes.map(note => ({ index: note.index, value: BigInt(note.amount) }))),
    [spendKind, notes],
  )

  const selection = useMemo(
    () => (candidates === null || feeForCount === null || amountCredits <= 0n
      ? null
      : selectSpendNotes(candidates, amountCredits, MAX_SPEND_NOTES, feeForCount)),
    [candidates, feeForCount, amountCredits],
  )

  const maxPerTx = useMemo(
    () => (candidates === null || feeForCount === null ? null : maxSpendableCredits(candidates, MAX_SPEND_NOTES, feeForCount)),
    [candidates, feeForCount],
  )

  const spendFee = feeForCount === null ? null : (selection?.feeCredits ?? feeForCount(FEE_QUOTE_MIN_NOTE_COUNT))
  const feeCredits = spendKind === null ? quote.data : spendFee
  const debouncing = pending !== null && pending.key !== settled?.key

  return {
    feeCredits,
    maxPerTx,
    loading: minimums.loading || quote.loading || debouncing,
    err: minimums.err ?? quote.err,
  }
}
