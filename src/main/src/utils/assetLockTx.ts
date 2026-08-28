import {Output, Script} from 'dash-core-sdk'
import {AssetLockTx} from 'dash-core-sdk/src/types/ExtraPayload/AssetLockTx.js'

import {
  ASSET_LOCK_PAYLOAD_VERSION,
  CREDITS_PER_DUFF,
  SHIELD_FUNDING_FEE_RESERVE_CREDITS,
} from '../constants/credits'

// The L2 transition takes its fee out of the credits the lock creates, so the
// lock has to carry that fee on top of the amount for the amount the user asked
// for to be the amount that arrives. Rounded up: a lock a credit short strands
// the whole funding.
export function lockedDuffsFor(amountDuffs: bigint, feeCredits: bigint): bigint {
  return amountDuffs + (feeCredits + CREDITS_PER_DUFF - 1n) / CREDITS_PER_DUFF
}

export function shieldAmountFromLockedDuffs(amountDuffs: bigint): bigint {
  const totalCredits = amountDuffs * CREDITS_PER_DUFF
  if (totalCredits <= SHIELD_FUNDING_FEE_RESERVE_CREDITS) {
    throw new Error(
      `Locked amount is too small to shield — it must exceed the ${SHIELD_FUNDING_FEE_RESERVE_CREDITS.toLocaleString('en-US')} credit fee reserve`,
    )
  }
  return totalCredits - SHIELD_FUNDING_FEE_RESERVE_CREDITS
}

export function buildAssetLockOutputs(amountDuffs: bigint, creditAddress: string): {burnOutput: Output; extraPayload: AssetLockTx} {
  if (amountDuffs <= 0n) {
    throw new Error('Asset lock amount must be greater than zero')
  }
  const burnScript = new Script()
  burnScript.pushOpCode('OP_RETURN')
  burnScript.pushOpCode('OP_0')
  const burnOutput = new Output(amountDuffs, burnScript)
  const creditOutput = Output.createP2PKH(amountDuffs, creditAddress)
  return {burnOutput, extraPayload: new AssetLockTx(ASSET_LOCK_PAYLOAD_VERSION, 1, [creditOutput])}
}
