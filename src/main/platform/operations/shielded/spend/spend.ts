import {IdentityCreateFromShieldedPoolTransitionWASM, RecoveredNoteWASM} from 'pshenmic-dpp'
import {bundleActions, maxSpendableCredits, selectableNotes, selectSpendNotes} from '../../../../src/utils/shieldedNoteSelection'
import {PlatformOperations} from '../../../types/messages'
import {OperationContext, OperationError, throwIfAborted} from '../../types'
import {consensusMessage} from '../../consensusMessage'
import {buildTransition} from './buildTransition'
import {checkSpent} from '../checkSpent'
import {actualFee, minimumFee} from './fee'
import {MAX_SPEND_NOTES, MAX_SPEND_RECIPIENTS} from '../../../../src/constants/credits'
import {SHIELDED_ACCOUNT} from '../../../../src/constants/addresses'
import {waitForResult} from './waitForResult'

type Payload = PlatformOperations['spend']['payload']
type Result = PlatformOperations['spend']['result']

export async function spend(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network, signal} = ctx
  const {seed, kind, notes: all, recipients} = payload
  const amount = payload.amountCredits

  if (amount <= 0n) throw new OperationError('Amount must be greater than zero', 'internal')

  // Only a transfer fans out; the two payouts name exactly one address and an
  // identity create names none, so the count is decided by the kind rather than
  // bounded from above. Every builder below indexes what this admits.
  const allowedRecipients = kind === 'shieldedTransfer' ? MAX_SPEND_RECIPIENTS
    : kind === 'identityCreateFromShielded' ? 0
    : 1
  if (recipients.length > allowedRecipients || recipients.length < Math.min(allowedRecipients, 1)) {
    throw new OperationError(
      `${kind} takes ${allowedRecipients} recipients at most, and was given ${recipients.length}`,
      'internal',
    )
  }

  // recoverNotes keys by array position; every index leaving this operation is
  // a pool index, which is what the note tables and the user's pick key on.
  const poolIndex = (note: RecoveredNoteWASM): number => all[note.index]?.index ?? note.index

  const recovered = sdk.shielded.recoverNotes(all, seed, SHIELDED_ACCOUNT)
  throwIfAborted(signal)

  // Before proving, not after: a proof costs seconds and the nullifier query
  // one round trip.
  const checked = await checkSpent(sdk, recovered)
  const stale = checked.filter(({spent}) => spent).map(({recoveredNote}) => poolIndex(recoveredNote))
  if (stale.length > 0) ctx.notesSpent(stale)

  // Only a pool-to-pool transfer writes its payouts as Orchard outputs; the
  // rest leave the pool, so they add no action beyond the change note.
  const outputCount = kind === 'shieldedTransfer' ? recipients.length : 0
  const fee = (numSpends: number): bigint => minimumFee(kind, bundleActions(numSpends, outputCount))
  const selectable = selectableNotes(
    checked.map(({recoveredNote, spent}) => ({index: poolIndex(recoveredNote), value: recoveredNote.note.value, spent})),
    payload.source,
  )
  const selection = selectSpendNotes(selectable, amount, MAX_SPEND_NOTES, fee, payload.source)
  if (selection == null) {
    const max = maxSpendableCredits(selectable, MAX_SPEND_NOTES, fee, payload.source)
    throw new OperationError(
      `Amount plus the network fee exceeds what ${MAX_SPEND_NOTES} notes can cover; the most spendable now is ${max} credits`,
      'insufficientFunds',
    )
  }

  const selected = new Set(selection.selected.map(note => note.index))
  const toSpend = checked
    .filter(({recoveredNote}) => selected.has(poolIndex(recoveredNote)))
    .map(({recoveredNote}) => recoveredNote)
  const {spends, anchor} = sdk.shielded.buildSpendableNotes(all, toSpend)
  const changeAddress = sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT)

  ctx.progress('proving', all.length, all.length)
  const stateTransition = await buildTransition(sdk, network, payload, spends, anchor, changeAddress)
  throwIfAborted(signal)

  const stHash = stateTransition.hash(false)
  const identityId = kind === 'identityCreateFromShielded'
    ? IdentityCreateFromShieldedPoolTransitionWASM.fromStateTransition(stateTransition).identityId.base58()
    : null

  ctx.progress('broadcasting', all.length, all.length)
  try {
    await sdk.stateTransitions.broadcast(stateTransition)
  } catch (e) {
    throw new OperationError(consensusMessage(e), 'network', stHash)
  }

  ctx.progress('awaitingResult', all.length, all.length)
  try {
    await waitForResult(sdk, stateTransition, kind)
  } catch (e) {
    throw new OperationError(consensusMessage(e), 'network', stHash)
  }

  ctx.notesSpent(toSpend.map(poolIndex))

  return {stHash, identityId, feeCredits: actualFee(stateTransition, kind, amount)}
}
