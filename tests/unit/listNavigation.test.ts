import { describe, expect, it } from 'vitest'
import { nextListIndex } from '../../src/renderer/src/utils/listNavigation'

describe('nextListIndex', () => {
  it('wraps arrow keys around both ends', () => {
    expect(nextListIndex(0, 'ArrowDown', 3)).toBe(1)
    expect(nextListIndex(2, 'ArrowDown', 3)).toBe(0)
    expect(nextListIndex(1, 'ArrowUp', 3)).toBe(0)
    expect(nextListIndex(0, 'ArrowUp', 3)).toBe(2)
  })

  it('jumps to the ends with Home and End', () => {
    expect(nextListIndex(1, 'Home', 9)).toBe(0)
    expect(nextListIndex(1, 'End', 9)).toBe(8)
  })

  it('enters the list from nothing active or a stale index', () => {
    expect(nextListIndex(-1, 'ArrowDown', 3)).toBe(0)
    expect(nextListIndex(-1, 'ArrowUp', 3)).toBe(2)
    expect(nextListIndex(7, 'ArrowDown', 3)).toBe(0)
    expect(nextListIndex(7, 'ArrowUp', 3)).toBe(2)
  })

  it('keeps the index for other keys and has nothing to select in an empty list', () => {
    expect(nextListIndex(1, 'a', 3)).toBe(1)
    expect(nextListIndex(0, 'ArrowDown', 0)).toBe(-1)
  })
})
