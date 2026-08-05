import { useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { CoreFeeQuote, Network, OperationFeeParams } from '@renderer/api/types'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { CoreFeeShape } from '@renderer/enums/CoreFeeShape'
import { FeeEndpoint } from '@renderer/enums/FeeEndpoint'
import {
  SelectableNote,
  SpendFeeForCount,
  maxSpendableCredits,
  selectSpendNotes,
} from '@renderer/utils/shieldedNoteSelection'
import { coreFeeShapeFor, feeQueryFor, feeQueryKey } from '@renderer/utils/transitionFeeQuery'
import { operationInfo } from '@renderer/utils/transferMatrix'
import {
  CORE_FEE_ERROR,
  FEE_QUOTE_MIN_NOTE_COUNT,
  MAX_SPEND_NOTES,
  TRANSITION_FEE_DEBOUNCE_MS,
  TRANSITION_FEE_ERROR,
} from '@renderer/constants'
import { useAsyncWithCache } from './useAsyncWithCache'

export function useOperationFee(
  network: Network | null,
  walletId: string | null,
  operation: TransferOperation | null,
  params: OperationFeeParams,
): {
  feeCredits: bigint | null
  maxPerTx: bigint | null
  feeDuffs: bigint | null
  maxSendableDuffs: bigint | null
  loading: boolean
  err: string | null
} {
  const { notes, amountCredits, amountDuffs, destinationValid, recipient, fromAddress, source, identityId } = params
  const spendKind = operation === null ? null : operationInfo(operation).spendKind
  const coreShape = coreFeeShapeFor(operation)

  const minimums = useAsyncWithCache<bigint[] | null>(
    'transition-fee-minimums',
    network !== null && spendKind !== null ? `${network}:${spendKind}` : undefined,
    () => Promise.all(Array.from({ length: MAX_SPEND_NOTES }, (_, i) =>
      API.estimateTransitionFee(network!, {
        kind: 'shieldedSpend',
        spendKind: spendKind!,
        noteCount: i + FEE_QUOTE_MIN_NOTE_COUNT,
        recipients: [],
      }).then(quote => BigInt(quote.minFeeCredits)))),
    null,
    { errorMessage: TRANSITION_FEE_ERROR },
  )

  const maxQuote = useAsyncWithCache<CoreFeeQuote | null>(
    'core-fee-max',
    network !== null && walletId !== null && coreShape !== null
      ? `${network}:${walletId}:${coreShape}:${fromAddress ?? ''}`
      : undefined,
    () => API.estimateCoreFee(
      walletId!,
      coreShape === CoreFeeShape.Send
        ? { shape: CoreFeeShape.Send, amountDuffs: 0n, toAddress: null, fromAddress }
        : { shape: CoreFeeShape.AssetLock, amountDuffs: 0n },
    ),
    null,
    { errorMessage: CORE_FEE_ERROR },
  )

  const pending = useMemo(
    () => {
      const tagged = feeQueryFor(operation, { destinationValid, recipient, amountCredits, amountDuffs, fromAddress, source, identityId })
      if (network === null || tagged === null) return null
      if (tagged.endpoint === FeeEndpoint.Core) {
        return walletId === null ? null : { tagged, key: `${network}:${walletId}:${feeQueryKey(tagged.query)}` }
      }
      return { tagged, key: `${network}:${feeQueryKey(tagged.query)}` }
    },
    [network, walletId, operation, destinationValid, recipient, amountCredits, amountDuffs, fromAddress, source?.platformAddress, source?.nonce, identityId],
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
    () => {
      const tagged = settled!.tagged
      return tagged.endpoint === FeeEndpoint.Core
        ? API.estimateCoreFee(walletId!, tagged.query).then(q => q.feeDuffs)
        : API.estimateTransitionFee(network!, tagged.query).then(q => BigInt(q.totalFeeCredits))
    },
    null,
    { errorMessage: settled?.tagged.endpoint === FeeEndpoint.Core ? CORE_FEE_ERROR : TRANSITION_FEE_ERROR },
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
  const feeCredits = coreShape !== null ? null : (spendKind === null ? quote.data : spendFee)
  const feeDuffs = coreShape !== null ? quote.data : null
  const maxSendableDuffs = coreShape !== null ? (maxQuote.data?.maxSendableDuffs ?? null) : null
  const debouncing = pending !== null && pending.key !== settled?.key

  return {
    feeCredits,
    maxPerTx,
    feeDuffs,
    maxSendableDuffs,
    loading: minimums.loading || quote.loading || maxQuote.loading || debouncing,
    err: minimums.err ?? quote.err ?? maxQuote.err,
  }
}
