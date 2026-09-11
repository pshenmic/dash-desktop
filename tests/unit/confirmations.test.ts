import {describe, it, expect} from 'vitest'
import {confirmationsAt} from '../../src/main/src/utils/confirmations'

describe('counting confirmations against the chain tip', () => {
  it('counts the block a coin confirmed in as its first confirmation', () => {
    expect(confirmationsAt(2_300_000, 2_300_000)).toBe(1)
    expect(confirmationsAt(2_300_000, 2_300_005)).toBe(6)
  })

  it('answers zero for a coin still in the mempool', () => {
    expect(confirmationsAt(0, 2_300_000)).toBe(0)
  })

  // Sync stopped, or headers still behind the block a scan already applied.
  it('answers zero rather than a negative count when the tip is unknown', () => {
    expect(confirmationsAt(2_300_000, 0)).toBe(0)
    expect(confirmationsAt(2_300_000, 2_299_999)).toBe(0)
  })
})
