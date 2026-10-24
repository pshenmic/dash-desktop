import { describe, it, expect } from 'vitest'
import { isUsedCoreAddress } from '../../src/renderer/src/utils/addressUsage'

describe('isUsedCoreAddress', () => {
  it('is false for a fresh address', () => {
    expect(isUsedCoreAddress({ isUsed: false, txCount: 0 })).toBe(false)
  })

  it('is true once the address has transactions', () => {
    expect(isUsedCoreAddress({ isUsed: false, txCount: 2 })).toBe(true)
  })

  it('is true when discovery marked it used before its history loaded', () => {
    expect(isUsedCoreAddress({ isUsed: true, txCount: 0 })).toBe(true)
  })
})
