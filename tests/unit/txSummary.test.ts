import { describe, it, expect } from 'vitest'
import { moreRecipientsLabel, splitVisibleRecipients, txAmountToDuffs } from '../../src/renderer/src/utils/txSummary'

describe('txAmountToDuffs', () => {
  it('passes duffs through', () => {
    expect(txAmountToDuffs(123_456_789n, 'duffs')).toBe(123_456_789n)
  })

  it('truncates credits to whole duffs', () => {
    expect(txAmountToDuffs(1_162_851_200n, 'credits')).toBe(1_162_851n)
    expect(txAmountToDuffs(999n, 'credits')).toBe(0n)
  })
})

describe('splitVisibleRecipients', () => {
  it('keeps every recipient within the limit', () => {
    expect(splitVisibleRecipients(['a', 'b', 'c'], 3)).toEqual({ visible: ['a', 'b', 'c'], hidden: 0 })
  })

  it('cuts the list and counts the rest past the limit', () => {
    expect(splitVisibleRecipients(['a', 'b', 'c', 'd', 'e'], 3)).toEqual({ visible: ['a', 'b', 'c'], hidden: 2 })
  })

  it('handles an empty list', () => {
    expect(splitVisibleRecipients([], 3)).toEqual({ visible: [], hidden: 0 })
  })
})

describe('moreRecipientsLabel', () => {
  it('names the hidden count', () => {
    expect(moreRecipientsLabel(997)).toBe('+997 more')
  })
})
