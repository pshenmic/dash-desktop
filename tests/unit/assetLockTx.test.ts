import { describe, it, expect } from 'vitest'
import { utils as sdkUtils } from 'dash-core-sdk'
import { AssetLockTx } from 'dash-core-sdk/src/types/ExtraPayload/AssetLockTx.js'
import {
  buildAssetLockOutputs,
  shieldAmountFromLockedDuffs,
  ASSET_LOCK_PAYLOAD_VERSION,
  ASSET_LOCK_CREDIT_OUTPUT_INDEX,
  CREDITS_PER_DUFF,
  SHIELD_FUNDING_FEE_RESERVE_CREDITS,
} from '../../src/main/src/utils/assetLockTx'

const keyHash = new Uint8Array(20).fill(9)
const creditAddress = sdkUtils.publicKeyHashToAddress(keyHash, 'testnet')
const AMOUNT = 100_000n

describe('buildAssetLockOutputs', () => {
  it('builds an OP_RETURN burn output carrying the locked amount', () => {
    const {burnOutput} = buildAssetLockOutputs(AMOUNT, creditAddress)
    expect(burnOutput.satoshis).toBe(AMOUNT)
    expect(burnOutput.hex()).toBe('a086010000000000026a00')
  })

  it('builds a version-1 payload with a single p2pkh credit output', () => {
    const {extraPayload} = buildAssetLockOutputs(AMOUNT, creditAddress)
    expect(extraPayload.version).toBe(ASSET_LOCK_PAYLOAD_VERSION)
    expect(extraPayload.count).toBe(1)
    expect(extraPayload.outputs).toHaveLength(1)
    expect(extraPayload.outputs[ASSET_LOCK_CREDIT_OUTPUT_INDEX].satoshis).toBe(AMOUNT)
    expect(extraPayload.outputs[ASSET_LOCK_CREDIT_OUTPUT_INDEX].hex()).toBe(`a086010000000000` + `1976a914${'09'.repeat(20)}88ac`)
  })

  it('round-trips the payload through serialization', () => {
    const {extraPayload} = buildAssetLockOutputs(AMOUNT, creditAddress)
    const decoded = AssetLockTx.fromBytes(extraPayload.bytes())
    expect(decoded.version).toBe(extraPayload.version)
    expect(decoded.count).toBe(extraPayload.count)
    expect(decoded.outputs[0].hex()).toBe(extraPayload.outputs[0].hex())
  })

  it('rejects a non-positive amount', () => {
    expect(() => buildAssetLockOutputs(0n, creditAddress)).toThrow('greater than zero')
  })
})

describe('shieldAmountFromLockedDuffs', () => {
  it('converts duffs to credits and deducts the fee reserve', () => {
    expect(shieldAmountFromLockedDuffs(10_000_000n)).toBe(10_000_000n * CREDITS_PER_DUFF - SHIELD_FUNDING_FEE_RESERVE_CREDITS)
  })

  it('rejects amounts that do not exceed the fee reserve', () => {
    const atReserve = SHIELD_FUNDING_FEE_RESERVE_CREDITS / CREDITS_PER_DUFF
    expect(() => shieldAmountFromLockedDuffs(atReserve)).toThrow('too small to shield')
  })
})
