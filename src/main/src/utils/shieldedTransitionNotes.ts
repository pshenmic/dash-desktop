import {
  IdentityCreateFromShieldedPoolTransitionWASM,
  ShieldFromAssetLockTransitionWASM,
  ShieldTransitionWASM,
  ShieldedTransferTransitionWASM,
  ShieldedWithdrawalTransitionWASM,
  StateTransitionWASM,
  UnshieldTransitionWASM,
} from 'pshenmic-dpp'
import {PlatformTransaction, TransitionHeader} from '../types/PlatformTransaction'
import {PersistNote, ShieldedAction} from '../types/ShieldedNote'

// Both maps are keyed on bytes, so they have to agree on the encoding.
export const noteKey = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex')

const actionsOf = (transition: {actions: {cmx: Uint8Array, nullifier: Uint8Array}[]}): ShieldedAction[] =>
  transition.actions.map(action => ({cmx: action.cmx, nullifier: action.nullifier}))

// A shielded transition names no party and no amount: an action is readable
// only against notes this wallet has decrypted.
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

// One action carries a note paid and a note spent, and either half can be
// someone else's: an unshield spends ours and pays our change back in the pair.
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

// The net carries the direction, so the amount stops being the surplus a shield
// sent back to an address.
export function noteSideTransaction(
  walletId: string,
  gap: TransitionHeader,
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
