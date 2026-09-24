import {
  IdentityCreateFromShieldedPoolTransitionWASM,
  ShieldFromAssetLockTransitionWASM,
  ShieldTransitionWASM,
  ShieldedTransferTransitionWASM,
  ShieldedWithdrawalTransitionWASM,
  StateTransitionWASM,
  UnshieldTransitionWASM,
} from 'pshenmic-dpp'
import {PlatformTransaction, ShieldedGap} from '../types/PlatformTransaction'
import {PersistNote, ShieldedAction} from '../types/ShieldedNote'

// Both maps are keyed on bytes, so they have to agree on the encoding.
export const noteKey = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex')

const actionsOf = (transition: {actions: {cmx: Uint8Array, nullifier: Uint8Array}[]}): ShieldedAction[] =>
  transition.actions.map(action => ({cmx: action.cmx, nullifier: action.nullifier}))

// Every shielded transition is a list of Orchard actions and nothing else that
// names a party: no address, no amount. Which of them are this wallet's is
// readable only against notes it has decrypted.
export function shieldedActions(data: string): ShieldedAction[] {
  const transition = StateTransitionWASM.fromBytes(Buffer.from(data, 'base64'))

  switch (transition.getActionName()) {
    case 'Shield':
      return actionsOf(ShieldTransitionWASM.fromStateTransition(transition))
    case 'ShieldFromAssetLock':
      return actionsOf(ShieldFromAssetLockTransitionWASM.fromStateTransition(transition))
    case 'Unshield':
      return actionsOf(UnshieldTransitionWASM.fromStateTransition(transition))
    case 'ShieldedTransfer':
      return actionsOf(ShieldedTransferTransitionWASM.fromStateTransition(transition))
    case 'ShieldedWithdrawal':
      return actionsOf(ShieldedWithdrawalTransitionWASM.fromStateTransition(transition))
    case 'IdentityCreateFromShieldedPool':
      return actionsOf(IdentityCreateFromShieldedPoolTransitionWASM.fromStateTransition(transition))
    default:
      return []
  }
}

// What each shielded address of ours moved in one transition: a note paid to it
// counts up, a note of ours it spent counts down. One action carries both, and
// either half can belong to someone else — an unshield spends our note and pays
// our change back through the same action pair.
export function shieldedSides(
  actions: ShieldedAction[],
  byCmx: Map<string, PersistNote>,
  byNullifier: Map<string, PersistNote>,
): Map<string, bigint> {
  const sides = new Map<string, bigint>()

  for (const action of actions) {
    const received = byCmx.get(noteKey(action.cmx))
    if (received != null) sides.set(received.address, (sides.get(received.address) ?? 0n) + received.amount)

    const spent = byNullifier.get(noteKey(action.nullifier))
    if (spent != null) sides.set(spent.address, (sides.get(spent.address) ?? 0n) - spent.amount)
  }

  return sides
}

// Stored like any walk's row, so the fold counts the pool as one more side this
// wallet was on: the net carries the direction, and the amount stops being the
// surplus a shield sent back to an address.
export function noteSideTransaction(
  walletId: string,
  gap: ShieldedGap,
  address: string,
  net: bigint,
): PlatformTransaction {
  const moved = net < 0n ? -net : net
  const end = [{source: address, amount: moved}]

  return {
    walletId,
    hash: gap.hash,
    type: gap.type,
    date: gap.date,
    blockHeight: gap.blockHeight,
    status: gap.status,
    error: null,
    gasCredits: gap.gasCredits,
    netCredits: net,
    amountCredits: moved,
    sender: net < 0n ? end : [],
    recipient: net > 0n ? end : [],
  }
}
