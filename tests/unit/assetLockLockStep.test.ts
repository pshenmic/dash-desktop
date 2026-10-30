import { describe, it, expect } from 'vitest'
import { assetLockLockStep } from '../../src/renderer/src/utils/assetLockFunding'
import { AssetLockLockStep } from '../../src/renderer/src/enums/AssetLockLockStep'
import { LockKind } from '../../src/renderer/src/enums/LockKind'

describe('assetLockLockStep', () => {
  it('reports the received lock regardless of activity or fallback', () => {
    expect(assetLockLockStep(LockKind.Instant, true, true)).toBe(AssetLockLockStep.InstantLocked)
    expect(assetLockLockStep(LockKind.Instant, false, false)).toBe(AssetLockLockStep.InstantLocked)
    expect(assetLockLockStep(LockKind.Chain, true, false)).toBe(AssetLockLockStep.ChainLocked)
    expect(assetLockLockStep(LockKind.Chain, false, true)).toBe(AssetLockLockStep.ChainLocked)
  })

  it('stays pending while the step is not active', () => {
    expect(assetLockLockStep(null, false, false)).toBe(AssetLockLockStep.Pending)
    expect(assetLockLockStep(null, false, true)).toBe(AssetLockLockStep.Pending)
  })

  it('waits for an InstantSend lock until the fallback kicks in', () => {
    expect(assetLockLockStep(null, true, false)).toBe(AssetLockLockStep.WaitingInstantLock)
    expect(assetLockLockStep(null, true, true)).toBe(AssetLockLockStep.WaitingChainLock)
  })
})
