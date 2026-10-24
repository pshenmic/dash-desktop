import { describe, expect, it } from 'vitest'
import { identityLabel, identityName, isIdentifierLike } from '../../src/renderer/src/utils/identifierFormat'

const IDENTIFIER = 'B7kcEqgCRhLp2Wq5WZbeT4yUcZR8BWh3X1o3qDtLCpQH'

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

describe('identityName', () => {
  it('prefers the oldest owned name, then the alias, and is null without either', () => {
    expect(identityName({ alias: 'old.dash', aliasesList: ['bbbbbbbasa.dash', 'b2.dash'] })).toBe('bbbbbbbasa.dash')
    expect(identityName({ alias: 'old.dash', aliasesList: [] })).toBe('old.dash')
    expect(identityName({ alias: null, aliasesList: [] })).toBeNull()
  })
})

describe('identityLabel', () => {
  it('prefers the oldest owned name, then the alias, then the full identifier', () => {
    expect(identityLabel({ identifier: IDENTIFIER, alias: 'old.dash', aliasesList: ['bbbbbbbasa.dash', 'b2.dash'] })).toBe('bbbbbbbasa.dash')
    expect(identityLabel({ identifier: IDENTIFIER, alias: 'old.dash', aliasesList: [] })).toBe('old.dash')
    expect(identityLabel({ identifier: IDENTIFIER, alias: null, aliasesList: [] })).toBe(IDENTIFIER)
  })
})
