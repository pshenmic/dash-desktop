import { describe, expect, it } from 'vitest'
import { identifierParts } from '../../src/renderer/src/utils/identifierParts'

describe('identifierParts', () => {
  it('keeps five characters on each edge and dims the middle', () => {
    expect(identifierParts('yPNLLxgahV8xoqbcnDvozccv66cwMatA2p')).toEqual({
      first: 'yPNLL',
      middle: 'xgahV8xoqbcnDvozccv66cwM',
      last: 'atA2p',
    })
  })

  it('reassembles to the original text', () => {
    const text = 'tdash1kz2e6rudezas4y3htwh7ktlgrhqvf05hzs7r65as'
    const { first, middle, last } = identifierParts(text)
    expect(first + middle + last).toBe(text)
  })

  it('does not repeat characters of a value too short to split', () => {
    expect(identifierParts('abc')).toEqual({ first: 'abc', middle: '', last: '' })
    expect(identifierParts('0123456789')).toEqual({ first: '0123456789', middle: '', last: '' })
  })

  it('splits a value one character longer than both edges', () => {
    expect(identifierParts('0123456789a')).toEqual({ first: '01234', middle: '5', last: '6789a' })
  })
})
