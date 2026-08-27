import {
  IdentityCreateFromShieldedPoolTransitionWASM,
  ShieldedTransferTransitionWASM,
  ShieldedWithdrawalTransitionWASM,
  StateTransitionWASM,
  UnshieldTransitionWASM,
} from 'pshenmic-dpp'
import {PoolSpendOperation} from '../../../types/messages'
import {IDENTITY_KEY_DEFINITIONS} from '../../../../src/constants'
import {MIN_BUNDLE_ACTIONS} from '../constants'
// What consensus will charge, from the protocol implementation itself. Never
// reimplement this: it is versioned (`platformVersion`) and scales with the
// action count, which is why a constant table cannot track it.
export function minimumFee(kind: PoolSpendOperation, numSpends: number): bigint {
  const actions = Math.max(numSpends, MIN_BUNDLE_ACTIONS)
  switch (kind) {
    case 'shieldedTransfer':
      return ShieldedTransferTransitionWASM.computeMinimumFee(actions)
    case 'unshield':
      return UnshieldTransitionWASM.computeMinimumFee(actions)
    case 'shieldedWithdrawal':
      return ShieldedWithdrawalTransitionWASM.computeMinimumFee(actions)
    case 'identityCreateFromShielded':
      return IdentityCreateFromShieldedPoolTransitionWASM.computeMinimumFee(
        actions,
        IDENTITY_KEY_DEFINITIONS.length,
      )
  }
}

// The bundle's value_balance: what left the pool once the bundle was proven.
// Named valueBalance on a transfer, which is pool -> pool so all of it is fee,
// and unshieldingAmount on the two payouts, which also carry the payout.
export function actualFee(st: StateTransitionWASM, kind: PoolSpendOperation, payout: bigint): bigint | null {
  switch (kind) {
    case 'shieldedTransfer':
      return ShieldedTransferTransitionWASM.fromStateTransition(st).valueBalance
    case 'unshield':
      return UnshieldTransitionWASM.fromStateTransition(st).unshieldingAmount - payout
    case 'shieldedWithdrawal':
      return ShieldedWithdrawalTransitionWASM.fromStateTransition(st).unshieldingAmount - payout
    case 'identityCreateFromShielded':
      // Funded by the denomination; the transition carries no value_balance.
      return null
  }
}
