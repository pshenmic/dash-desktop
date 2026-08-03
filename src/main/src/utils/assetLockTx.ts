import {Output, Script} from 'dash-core-sdk'
import {AssetLockTx} from 'dash-core-sdk/src/types/ExtraPayload/AssetLockTx.js'

import {
  ASSET_LOCK_PAYLOAD_VERSION,
  CREDITS_PER_DUFF,
  SHIELD_FUNDING_FEE_RESERVE_CREDITS,
} from '../constants'

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
