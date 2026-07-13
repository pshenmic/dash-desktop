import { describe, it, expect } from 'vitest'
import {
  isUnusedPlatformAddress,
  defaultReceivePlatformAddress,
} from '../../src/renderer/src/utils/platformReceive'

const addr = (platformAddress: string, balanceCredits: string, nonce: number) =>
  ({ platformAddress, balanceCredits, nonce })

describe('isUnusedPlatformAddress', () => {
  it('is true for zero balance and zero nonce', () => {
    expect(isUnusedPlatformAddress(addr('a', '0', 0))).toBe(true)
  })

  it('is false when funded', () => {
    expect(isUnusedPlatformAddress(addr('a', '100', 0))).toBe(false)
  })

  it('is false when the nonce advanced even with zero balance', () => {
    expect(isUnusedPlatformAddress(addr('a', '0', 3))).toBe(false)
  })
})

describe('defaultReceivePlatformAddress', () => {
  it('picks the first unused address', () => {
    const list = [addr('a', '500', 2), addr('b', '0', 1), addr('c', '0', 0), addr('d', '0', 0)]
    expect(defaultReceivePlatformAddress(list)?.platformAddress).toBe('c')
  })

  it('falls back to the first address when all are used', () => {
    const list = [addr('a', '500', 2), addr('b', '10', 0)]
    expect(defaultReceivePlatformAddress(list)?.platformAddress).toBe('a')
  })

  it('returns undefined for an empty list', () => {
    expect(defaultReceivePlatformAddress([])).toBeUndefined()
  })
})
