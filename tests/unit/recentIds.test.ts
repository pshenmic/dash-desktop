import {describe, it, expect} from 'vitest'
import {RecentIds} from '../../src/main/src/utils/recentIds'

describe('RecentIds', () => {
  it('claims an id the first time and refuses it after', () => {
    const ids = new RecentIds(10)
    expect(ids.claim('a')).toBe(true)
    expect(ids.claim('a')).toBe(false)
  })

  it('keeps ids apart', () => {
    const ids = new RecentIds(10)
    expect(ids.claim('a')).toBe(true)
    expect(ids.claim('b')).toBe(true)
  })

  // The oldest falls out so a long-lived process cannot grow the set forever.
  it('forgets the oldest id past the limit', () => {
    const ids = new RecentIds(2)
    ids.claim('a')
    ids.claim('b')
    ids.claim('c')
    expect(ids.claim('a')).toBe(true)
    expect(ids.claim('c')).toBe(false)
  })

  it('does not let a repeat push anything out', () => {
    const ids = new RecentIds(2)
    ids.claim('a')
    ids.claim('b')
    ids.claim('b')
    expect(ids.claim('a')).toBe(false)
  })

  it('claims nothing twice at a limit of one', () => {
    const ids = new RecentIds(1)
    expect(ids.claim('a')).toBe(true)
    expect(ids.claim('b')).toBe(true)
    expect(ids.claim('a')).toBe(true)
  })
})
