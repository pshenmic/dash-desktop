import {Output, Script} from 'dash-core-sdk'
import {AssetLockTx} from 'dash-core-sdk/src/types/ExtraPayload/AssetLockTx.js'

import {ASSET_LOCK_PAYLOAD_VERSION, CREDITS_PER_DUFF} from '../constants/credits'
import type {AssetLockFeeOperation} from '../../platform/types/messages'

// The L2 transition takes its fee out of the credits the lock creates, so the
// lock has to carry that fee on top of the amount for the amount the user asked
// for to be the amount that arrives. Rounded up: a lock a credit short strands
// the whole funding.
export function lockedDuffsFor(amountDuffs: bigint, feeCredits: bigint): bigint {
  return amountDuffs + (feeCredits + CREDITS_PER_DUFF - 1n) / CREDITS_PER_DUFF
}

// What a lock credits once its transition's fee is taken out of it.
export function creditsAfterFee(lockedDuffs: bigint, feeCredits: bigint): bigint {
  requireAboveFee(lockedDuffs, feeCredits)
  return lockedDuffs * CREDITS_PER_DUFF - feeCredits
}

export function requireAboveFee(lockedDuffs: bigint, feeCredits: bigint): void {
  if (lockedDuffs * CREDITS_PER_DUFF <= feeCredits) {
    throw new Error(
      `Locked amount is too small — it must exceed the ${feeCredits.toLocaleString('en-US')} credit fee`,
    )
  }
}

// A funding or a shield locks its L2 fee on top of the amount, so the amount is
// what arrives; an identity lock carries only the amount and pays the fee from it.
export function locksFeeOnTop(operation: AssetLockFeeOperation): boolean {
  return operation === 'assetLockFunding' || operation === 'assetLockShield'
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
