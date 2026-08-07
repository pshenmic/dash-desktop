import { describe, it, expect } from 'vitest'
import {
  computeScrollIndicator,
  computeThumbGrab,
  computeDragScrollTop,
} from '../../src/renderer/src/utils/scrollIndicator'
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

const TRACK = { trackTop: 100, trackHeight: 200, thumbHeightPercent: 50 }

describe('computeThumbGrab', () => {
  it('keeps the grab point when pressing on the thumb', () => {
    const grab = computeThumbGrab({ ...TRACK, thumbOffsetPercent: 0, pointerY: 140 })
    expect(grab).toEqual({ offset: 40, onThumb: true })
  })

  it('centers the thumb when pressing the track above it', () => {
    const grab = computeThumbGrab({ ...TRACK, thumbOffsetPercent: 50, pointerY: 120 })
    expect(grab).toEqual({ offset: 50, onThumb: false })
  })

  it('centers the thumb when pressing the track below it', () => {
    const grab = computeThumbGrab({ ...TRACK, thumbOffsetPercent: 0, pointerY: 250 })
    expect(grab).toEqual({ offset: 50, onThumb: false })
  })

  it('counts the thumb edges as the thumb', () => {
    expect(computeThumbGrab({ ...TRACK, thumbOffsetPercent: 0, pointerY: 100 }).onThumb).toBe(true)
    expect(computeThumbGrab({ ...TRACK, thumbOffsetPercent: 0, pointerY: 200 }).onThumb).toBe(true)
  })
})

describe('computeDragScrollTop', () => {
  const CONTENT = { scrollHeight: 1000, clientHeight: 500 }

  it('maps the top of the track to the top of the content', () => {
    expect(computeDragScrollTop({ ...TRACK, ...CONTENT, grabOffset: 0, pointerY: 100 })).toBe(0)
  })

  it('maps half the thumb travel to half the overflow', () => {
    expect(computeDragScrollTop({ ...TRACK, ...CONTENT, grabOffset: 0, pointerY: 150 })).toBe(250)
  })

  it('subtracts the grab offset from the pointer position', () => {
    expect(computeDragScrollTop({ ...TRACK, ...CONTENT, grabOffset: 50, pointerY: 200 })).toBe(250)
  })

  it('clamps a pointer dragged past either end of the track', () => {
    expect(computeDragScrollTop({ ...TRACK, ...CONTENT, grabOffset: 0, pointerY: 9999 })).toBe(500)
    expect(computeDragScrollTop({ ...TRACK, ...CONTENT, grabOffset: 0, pointerY: -9999 })).toBe(0)
  })

  it('returns zero when the content does not overflow', () => {
    const scrollTop = computeDragScrollTop({
      ...TRACK,
      grabOffset: 0,
      pointerY: 200,
      scrollHeight: 500,
      clientHeight: 500,
    })
    expect(scrollTop).toBe(0)
  })

  it('returns zero when the thumb fills the track', () => {
    const scrollTop = computeDragScrollTop({
      ...TRACK,
      ...CONTENT,
      thumbHeightPercent: 100,
      grabOffset: 0,
      pointerY: 200,
    })
    expect(scrollTop).toBe(0)
  })
})
