import { describe, expect, it } from 'vitest'
import { identityLabel, isIdentifierLike, shortIdentifier } from '../../src/renderer/src/utils/identifierFormat'

const IDENTIFIER = 'B7kcEqgCRhLp2Wq5WZbeT4yUcZR8BWh3X1o3qDtLCpQH'

describe('shortIdentifier', () => {
  it('keeps five characters on each side of an ellipsis', () => {
    expect(shortIdentifier(IDENTIFIER)).toBe('B7kcE…LCpQH')
  })

  it('leaves values that would not get shorter', () => {
    expect(shortIdentifier('abc')).toBe('abc')
    expect(shortIdentifier('0123456789a')).toBe('0123456789a')
    expect(shortIdentifier('0123456789ab')).toBe('01234…789ab')
  })
})

describe('isIdentifierLike', () => {
  it('accepts a 43–44 character base58 value, trimmed', () => {
    expect(isIdentifierLike(IDENTIFIER)).toBe(true)
    expect(isIdentifierLike(` ${IDENTIFIER.slice(1)} `)).toBe(true)
  })

  it('rejects other lengths and characters outside base58', () => {
    expect(isIdentifierLike(IDENTIFIER.slice(2))).toBe(false)
    expect(isIdentifierLike(`${IDENTIFIER.slice(1)}0`)).toBe(false)
    expect(isIdentifierLike(`${IDENTIFIER.slice(1)}l`)).toBe(false)
    expect(isIdentifierLike('alice')).toBe(false)
  })
})

describe('identityLabel', () => {
  it('prefers the oldest owned name, then the alias, then a short identifier', () => {
    expect(identityLabel({ identifier: IDENTIFIER, alias: 'old.dash', aliasesList: ['bbbbbbbasa.dash', 'b2.dash'] })).toBe('bbbbbbbasa.dash')
    expect(identityLabel({ identifier: IDENTIFIER, alias: 'old.dash', aliasesList: [] })).toBe('old.dash')
    expect(identityLabel({ identifier: IDENTIFIER, alias: null, aliasesList: [] })).toBe('B7kcE…LCpQH')
  })
})
