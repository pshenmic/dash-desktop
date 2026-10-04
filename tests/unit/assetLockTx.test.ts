import { describe, it, expect } from 'vitest'
import { utils as sdkUtils } from 'dash-core-sdk'
import { AssetLockTx } from 'dash-core-sdk/src/types/ExtraPayload/AssetLockTx.js'
import {buildAssetLockOutputs, creditsAfterFee, lockedDuffsFor, locksFeeOnTop, requireAboveFee} from '../../src/main/src/utils/assetLockTx'
import {
  ASSET_LOCK_CREDIT_OUTPUT_INDEX,
  ASSET_LOCK_PAYLOAD_VERSION,
  CREDITS_PER_DUFF,
} from '../../src/main/src/constants/credits'
import { ASSET_LOCK_PAYLOAD_BYTES } from '../../src/main/src/constants/chain'
const keyHash = new Uint8Array(20).fill(9)
const creditAddress = sdkUtils.publicKeyHashToAddress(keyHash, 'testnet')
const AMOUNT = 100_000n
const FEE = 212_851_200n

describe('buildAssetLockOutputs', () => {
  it('builds an OP_RETURN burn output carrying the locked amount', () => {
    const {burnOutput} = buildAssetLockOutputs(AMOUNT, creditAddress)
    expect(burnOutput.satoshis).toBe(AMOUNT)
    expect(burnOutput.hex()).toBe('a086010000000000026a00')
  })

  // The fee charges for these bytes before the payload exists, so the constant
  // it charges by has to be the size this builds.
  it('builds the payload the fee constant is sized for', () => {
    const {extraPayload} = buildAssetLockOutputs(AMOUNT, creditAddress)
    const payload = extraPayload.bytes().length
    expect(payload + sdkUtils.getCompactVariableSize(payload)).toBe(ASSET_LOCK_PAYLOAD_BYTES)
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

describe('creditsAfterFee', () => {
  it('converts duffs to credits and deducts the fee', () => {
    expect(creditsAfterFee(10_000_000n, FEE)).toBe(10_000_000n * CREDITS_PER_DUFF - FEE)
  })

  it('rejects amounts that do not exceed the fee', () => {
    expect(() => creditsAfterFee(FEE / CREDITS_PER_DUFF, FEE)).toThrow('too small')
  })
})

describe('lockedDuffsFor', () => {
  // The whole point: the user asks for 1.5 and gets at least 1.5, so the fee
  // rides on top of the lock rather than coming out of what arrives.
  it('locks the amount plus the fee the L2 transition will take', () => {
    expect(lockedDuffsFor(150_000_000n, 56_000_000n)).toBe(150_056_000n)
  })

  it('rounds a sub-duff fee up, since a lock a credit short strands the funding', () => {
    expect(lockedDuffsFor(1_000n, 1n)).toBe(1_001n)
    expect(lockedDuffsFor(1_000n, CREDITS_PER_DUFF + 1n)).toBe(1_002n)
  })

  // What a settle subtracts is what its start added, less the sub-duff round-up.
  it('is the inverse of creditsAfterFee', () => {
    const shielded = creditsAfterFee(lockedDuffsFor(AMOUNT, FEE), FEE)
    expect(shielded - AMOUNT * CREDITS_PER_DUFF).toBeGreaterThanOrEqual(0n)
    expect(shielded - AMOUNT * CREDITS_PER_DUFF).toBeLessThan(CREDITS_PER_DUFF)
  })
})

describe('locksFeeOnTop', () => {
  it('locks the fee on top for a funding or a shield, and takes it from an identity lock', () => {
    expect(locksFeeOnTop('assetLockFunding')).toBe(true)
    expect(locksFeeOnTop('assetLockShield')).toBe(true)
    expect(locksFeeOnTop('identityRegister')).toBe(false)
    expect(locksFeeOnTop('identityTopUpL1')).toBe(false)
  })
})

describe('requireAboveFee', () => {
  it('refuses a lock the fee would consume whole and passes one it would not', () => {
    expect(() => requireAboveFee(FEE / CREDITS_PER_DUFF, FEE)).toThrow('too small')
    expect(() => requireAboveFee(FEE / CREDITS_PER_DUFF + 1n, FEE)).not.toThrow()
  })
})
