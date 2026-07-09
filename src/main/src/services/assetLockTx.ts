import {Output, Script} from 'dash-core-sdk'
import {AssetLockTx} from 'dash-core-sdk/src/types/ExtraPayload/AssetLockTx.js'

export const ASSET_LOCK_PAYLOAD_VERSION = 1
export const ASSET_LOCK_CREDIT_OUTPUT_INDEX = 0

export function buildAssetLockOutputs(amountDuffs: bigint, creditAddress: string): {burnOutput: Output; extraPayload: AssetLockTx} {
  if (amountDuffs <= 0n) {
    throw new Error('Asset lock amount must be greater than zero')
  }
  const burnScript = new Script()
  burnScript.pushOpCode('OP_RETURN')
  const burnOutput = new Output(amountDuffs, burnScript)
  const creditOutput = Output.createP2PKH(amountDuffs, creditAddress)
  return {burnOutput, extraPayload: new AssetLockTx(ASSET_LOCK_PAYLOAD_VERSION, 1, [creditOutput])}
}
