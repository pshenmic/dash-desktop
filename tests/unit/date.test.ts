import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '../../src/renderer/src/utils/date'

describe('timestamp display', () => {
  it('formats the date and local time consistently with the transaction list', () => {
    expect(formatTimestamp(new Date(2026, 8, 11, 9, 15))).toBe('11 Sept 2026, 09:15')
  })

  it('does not turn a missing or invalid timestamp into an epoch date', () => {
    expect(formatTimestamp(null)).toBe('Unknown')
    expect(formatTimestamp(new Date(NaN))).toBe('Unknown')
  })
})
