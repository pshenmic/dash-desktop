import { describe, it, expect } from 'vitest'
import {
  computeDefaultWindowSize,
  parseWindowState,
  isVisibleOnSomeDisplay,
  restoreWindowState,
} from '../../src/main/src/utils/windowBounds'
import {
  WINDOW_MAX_DEFAULT_HEIGHT,
  WINDOW_MAX_DEFAULT_WIDTH,
} from '../../src/main/src/constants'
import { WindowState } from '../../src/main/src/types/WindowState'

const fullHd = { x: 0, y: 0, width: 1920, height: 1040 }

const state = (overrides: Partial<WindowState> = {}): WindowState => ({
  x: 100,
  y: 100,
  width: 1400,
  height: 800,
  maximized: false,
  ...overrides,
})

describe('computeDefaultWindowSize', () => {
  it('takes 85% of a full-HD work area', () => {
    expect(computeDefaultWindowSize({ width: 1920, height: 1040 })).toEqual({
      width: 1600,
      height: 884,
    })
  })

  it('fits inside a small laptop work area', () => {
    const size = computeDefaultWindowSize({ width: 1366, height: 728 })
    expect(size).toEqual({ width: 1161, height: 619 })
  })

  it('caps the size on large monitors', () => {
    expect(computeDefaultWindowSize({ width: 3840, height: 2160 })).toEqual({
      width: WINDOW_MAX_DEFAULT_WIDTH,
      height: WINDOW_MAX_DEFAULT_HEIGHT,
    })
  })
})

describe('parseWindowState', () => {
  it('accepts a well-formed state', () => {
    expect(parseWindowState(state())).toEqual(state())
  })

  it('defaults a missing maximized flag to false', () => {
    const { maximized: _maximized, ...rest } = state()
    expect(parseWindowState(rest)).toEqual(state({ maximized: false }))
  })

  it('rejects non-objects and partial shapes', () => {
    expect(parseWindowState(null)).toBeNull()
    expect(parseWindowState('big')).toBeNull()
    expect(parseWindowState({ x: 0, y: 0 })).toBeNull()
    expect(parseWindowState({ x: 0, y: 0, width: '1400', height: 800 })).toBeNull()
    expect(parseWindowState({ x: NaN, y: 0, width: 1400, height: 800 })).toBeNull()
  })

  it('rejects non-positive sizes', () => {
    expect(parseWindowState(state({ width: 0 }))).toBeNull()
    expect(parseWindowState(state({ height: -100 }))).toBeNull()
  })
})

describe('isVisibleOnSomeDisplay', () => {
  it('accepts a window inside the display', () => {
    expect(isVisibleOnSomeDisplay(state(), [fullHd])).toBe(true)
  })

  it('rejects a window fully outside every display', () => {
    expect(isVisibleOnSomeDisplay(state({ x: 3000, y: 100 }), [fullHd])).toBe(false)
  })

  it('rejects a window with only a sliver visible', () => {
    expect(isVisibleOnSomeDisplay(state({ x: 1920 - 50 }), [fullHd])).toBe(false)
  })

  it('accepts negative coordinates on a secondary display', () => {
    const secondary = { x: -1920, y: 0, width: 1920, height: 1040 }
    expect(isVisibleOnSomeDisplay(state({ x: -1800 }), [fullHd, secondary])).toBe(true)
  })
})

describe('restoreWindowState', () => {
  it('returns a valid on-screen state', () => {
    expect(restoreWindowState(state(), [fullHd])).toEqual(state())
  })

  it('returns null for corrupted json values', () => {
    expect(restoreWindowState(undefined, [fullHd])).toBeNull()
  })

  it('returns null when the saved position is off-screen', () => {
    expect(restoreWindowState(state({ y: 5000 }), [fullHd])).toBeNull()
  })
})
