import {describe, it, expect} from 'vitest'
import {chunk} from '../../src/main/src/utils/chunk'

describe('chunk', () => {
  it('splits into slices of the requested size', () => {
    expect(chunk([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 2], [3, 4], [5, 6]])
  })

  it('leaves the remainder short rather than padding it', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('answers no slices for no items', () => {
    expect(chunk([], 3)).toEqual([])
  })

  it('keeps everything in one slice when the size exceeds the input', () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]])
  })

  // A size of zero would otherwise slice forever.
  it('refuses a size below one', () => {
    expect(() => chunk([1, 2], 0)).toThrow('at least 1')
  })
})
