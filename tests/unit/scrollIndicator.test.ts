import { describe, it, expect } from 'vitest'
import { computeScrollIndicator } from '../../src/renderer/src/utils/scrollIndicator'
import {
  SCROLL_OVERFLOW_THRESHOLD_PX,
  MIN_THUMB_HEIGHT_PERCENT,
} from '../../src/renderer/src/constants/scrollIndicator'

describe('computeScrollIndicator', () => {
  it('reports no scroll when content fits', () => {
    const state = computeScrollIndicator({ scrollTop: 0, clientHeight: 800, scrollHeight: 800 })
    expect(state.canScroll).toBe(false)
    expect(state.thumbOffsetPercent).toBe(0)
  })

  it('reports no scroll when overflow is within the threshold', () => {
    const state = computeScrollIndicator({
      scrollTop: 0,
      clientHeight: 800,
      scrollHeight: 800 + SCROLL_OVERFLOW_THRESHOLD_PX,
    })
    expect(state.canScroll).toBe(false)
  })

  it('reports no scroll for a zero-height container', () => {
    const state = computeScrollIndicator({ scrollTop: 0, clientHeight: 0, scrollHeight: 1000 })
    expect(state.canScroll).toBe(false)
  })

  it('places the thumb at the top when not scrolled', () => {
    const state = computeScrollIndicator({ scrollTop: 0, clientHeight: 500, scrollHeight: 1000 })
    expect(state.canScroll).toBe(true)
    expect(state.thumbOffsetPercent).toBe(0)
    expect(state.thumbHeightPercent).toBe(50)
  })

  it('places the thumb in the middle at half scroll', () => {
    const state = computeScrollIndicator({ scrollTop: 250, clientHeight: 500, scrollHeight: 1000 })
    expect(state.thumbOffsetPercent).toBe(25)
    expect(state.thumbHeightPercent).toBe(50)
  })

  it('places the thumb at the bottom when fully scrolled', () => {
    const state = computeScrollIndicator({ scrollTop: 500, clientHeight: 500, scrollHeight: 1000 })
    expect(state.thumbOffsetPercent).toBe(50)
    expect(state.thumbOffsetPercent + state.thumbHeightPercent).toBe(100)
  })

  it('clamps scrollTop beyond the scrollable range', () => {
    const state = computeScrollIndicator({ scrollTop: 9999, clientHeight: 500, scrollHeight: 1000 })
    expect(state.thumbOffsetPercent + state.thumbHeightPercent).toBe(100)
  })

  it('clamps the thumb height to the minimum percent', () => {
    const state = computeScrollIndicator({ scrollTop: 0, clientHeight: 500, scrollHeight: 50000 })
    expect(state.thumbHeightPercent).toBe(MIN_THUMB_HEIGHT_PERCENT)
  })
})
