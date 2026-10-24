import { describe, expect, it } from 'vitest'
import { countLabel } from '../../src/renderer/src/utils/countLabel'
import { COUNT_NOUNS } from '../../src/renderer/src/constants/masternodeNodes'

describe('countLabel', () => {
  it('uses the singular only for one', () => {
    const forms = { one: 'request', other: 'requests' }
    expect(countLabel(1, forms)).toBe('1 request')
    expect(countLabel(0, forms)).toBe('0 requests')
    expect(countLabel(12, forms)).toBe('12 requests')
    expect(countLabel(1, COUNT_NOUNS.node)).toBe('1 node')
    expect(countLabel(24, COUNT_NOUNS.node)).toBe('24 nodes')
  })
})
