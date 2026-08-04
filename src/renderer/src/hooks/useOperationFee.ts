import { useEffect, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import { Network, OperationFeeParams, TransitionFeeQuery } from '@renderer/api/types'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import {
  SelectableNote,
  SpendFeeForCount,
  maxSpendableCredits,
  selectSpendNotes,
} from '@renderer/utils/shieldedNoteSelection'
import { feeQueryFor, feeQueryKey } from '@renderer/utils/transitionFeeQuery'
import { operationInfo } from '@renderer/utils/transferMatrix'
import { FEE_QUOTE_STORAGE_PROBE_NOTE_COUNT, MAX_SPEND_NOTES, TRANSITION_FEE_DEBOUNCE_MS } from '@renderer/constants'
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
  const unshieldRecipient = operation === TransferOperation.Unshield && destinationValid ? recipient : null

  const minimums = useAsyncWithCache<bigint[] | null>(
    'transition-fee-minimums',
    network !== null && spendKind !== null ? `${network}:${spendKind}` : undefined,
    () => Promise.all(Array.from({ length: MAX_SPEND_NOTES }, (_, i) =>
      API.estimateTransitionFee(network!, { kind: 'shieldedSpend', spendKind: spendKind!, noteCount: i + 1, recipients: [] })
        .then(quote => BigInt(quote.minFeeCredits)))),
    null,
  )

  const storage = useAsyncWithCache<bigint | null>(
    'transition-fee-storage',
    network !== null && spendKind !== null && unshieldRecipient !== null ? `${network}:${spendKind}:${unshieldRecipient}` : undefined,
    () => API.estimateTransitionFee(network!, {
      kind: 'shieldedSpend',
      spendKind: spendKind!,
      noteCount: FEE_QUOTE_STORAGE_PROBE_NOTE_COUNT,
      recipients: [unshieldRecipient!],
    }).then(quote => BigInt(quote.storageFeeCredits)),
    null,
  )

  const query = useMemo(
    () => feeQueryFor(operation, { destinationValid, recipient, amountCredits, source, identityId }),
    [operation, destinationValid, recipient, amountCredits, source?.platformAddress, source?.nonce, identityId],
  )
  const queryKey = useMemo(
    () => (network !== null && query !== null ? `${network}:${feeQueryKey(query)}` : undefined),
    [network, query],
  )
  const queryRef = useRef(query)
  queryRef.current = query

  const [settledQuery, setSettledQuery] = useState<TransitionFeeQuery | null>(null)

  useEffect(() => {
    if (queryKey === undefined) {
      setSettledQuery(null)
      return
    }
    const timer = setTimeout(() => setSettledQuery(queryRef.current), TRANSITION_FEE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [queryKey])

  const settledKey = useMemo(
    () => (network !== null && settledQuery !== null ? `${network}:${feeQueryKey(settledQuery)}` : undefined),
    [network, settledQuery],
  )

  const quote = useAsyncWithCache<bigint | null>(
    'transition-fee-quote',
    settledKey,
    () => API.estimateTransitionFee(network!, settledQuery!).then(q => BigInt(q.totalFeeCredits)),
    null,
  )

  const minByCount = minimums.data
  const storageFeeCredits = storage.data
  const storageLoading = storage.loading

  const feeForCount = useMemo<SpendFeeForCount | null>(
    () => (minByCount === null || storageLoading
      ? null
      : numSpends => minByCount[Math.min(Math.max(numSpends, 1), minByCount.length) - 1] + (storageFeeCredits ?? 0n)),
    [minByCount, storageFeeCredits, storageLoading],
  )

  const candidates = useMemo<SelectableNote[] | null>(
    () => (notes === null ? null : notes.map(note => ({ index: note.index, value: BigInt(note.amount) }))),
    [notes],
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

  const feeCredits = spendKind === null
    ? quote.data
    : feeForCount === null ? null : (selection?.feeCredits ?? feeForCount(1))

  return {
    feeCredits,
    maxPerTx,
    loading: minimums.loading || storageLoading || quote.loading || (queryKey !== undefined && queryKey !== settledKey),
    err: minimums.err ?? storage.err ?? quote.err,
  }
}
