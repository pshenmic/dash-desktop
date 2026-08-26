import {IdentityCreateFromShieldedPoolTransitionWASM} from 'pshenmic-dpp'
import {maxSpendableCredits, selectSpendNotes} from '../../../../src/utils/shieldedNoteSelection'
import {PlatformOperations} from '../../../types/messages'
import {OperationContext, OperationError, throwIfAborted} from '../../types'
import {consensusMessage} from '../../consensusMessage'
import {buildTransition} from './buildTransition'
import {checkSpent} from '../checkSpent'
import {actualFee, minimumFee} from './fee'
import {MAX_SPEND_NOTES} from '../constants'
import {SHIELDED_ACCOUNT} from '../../../../src/constants'
import {waitForResult} from './waitForResult'

type Payload = PlatformOperations['spend']['payload']
type Result = PlatformOperations['spend']['result']

export async function spend(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network, signal} = ctx
  const {seed, kind, notes: all} = payload
  const amount = payload.amountCredits

  if (amount <= 0n) throw new OperationError('Amount must be greater than zero', 'internal')

  const recovered = sdk.shielded.recoverNotes(all, seed, SHIELDED_ACCOUNT)
  throwIfAborted(signal)

  // Before proving, not after: a proof costs seconds and the nullifier query
  // one round trip.
  const checked = await checkSpent(sdk, recovered)
  const stale = checked.filter(({spent}) => spent).map(({recoveredNote}) => recoveredNote.index)
  if (stale.length > 0) ctx.notesSpent(stale)

  const unspent = checked.filter(({spent}) => !spent).map(({recoveredNote}) => recoveredNote)
  const available = payload.noteIndexes != null
    ? unspent.filter(note => payload.noteIndexes!.includes(note.index))
    : unspent

  const fee = (numSpends: number): bigint => minimumFee(kind, numSpends)
  const selectable = available.map(note => ({index: note.index, value: note.note.value}))
  const selection = selectSpendNotes(selectable, amount, MAX_SPEND_NOTES, fee)
  if (selection == null) {
    const max = maxSpendableCredits(selectable, MAX_SPEND_NOTES, fee)
    throw new OperationError(
      `Amount plus the network fee exceeds what ${MAX_SPEND_NOTES} notes can cover; the most spendable now is ${max} credits`,
      'insufficientFunds',
    )
  }

  const selected = new Set(selection.selected.map(note => note.index))
  const toSpend = available.filter(note => selected.has(note.index))
  const {spends, anchor} = sdk.shielded.buildSpendableNotes(all, toSpend)
  const changeAddress = sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT)

  ctx.progress('proving', all.length, all.length)
  const stateTransition = await buildTransition(sdk, network, payload, spends, anchor, changeAddress)
  throwIfAborted(signal)

  const stHash = stateTransition.hash(false)
  const identityId = kind === 'identityCreateFromPool'
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

  ctx.notesSpent(toSpend.map(note => note.index))

  return {stHash, identityId, feeCredits: actualFee(stateTransition, kind, amount)}
}
