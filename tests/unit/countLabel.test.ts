import { describe, expect, it } from 'vitest'
import { countLabel } from '../../src/renderer/src/utils/countLabel'
import { USERNAME_VOTE_FORMS } from '../../src/renderer/src/constants/dashPayUsernames'

describe('countLabel', () => {
  it('uses the singular only for one', () => {
    const forms = { one: 'request', other: 'requests' }
    expect(countLabel(1, forms)).toBe('1 request')
    expect(countLabel(0, forms)).toBe('0 requests')
    expect(countLabel(12, forms)).toBe('12 requests')
    expect(countLabel(1, USERNAME_VOTE_FORMS)).toBe('1 vote')
    expect(countLabel(24, USERNAME_VOTE_FORMS)).toBe('24 votes')
  })
})
