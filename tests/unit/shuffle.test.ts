import {describe, it, expect} from 'vitest'
import {shuffled} from '../../src/main/src/utils/shuffle'

describe('shuffled', () => {
  it('keeps every item and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5]
    expect([...shuffled(input)].sort()).toEqual([1, 2, 3, 4, 5])
    expect(input).toEqual([1, 2, 3, 4, 5])
  })

  it('takes any iterable', () => {
    expect(shuffled(new Set(['a']))).toEqual(['a'])
  })

  it('puts every item first about equally often', () => {
    const firsts = [0, 0, 0, 0]
    for (let i = 0; i < 4000; i++) firsts[shuffled([0, 1, 2, 3])[0]!]!++
    for (const count of firsts) expect(count).toBeGreaterThan(800)
  })
})
