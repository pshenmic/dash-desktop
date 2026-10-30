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
  it('is the oldest owned name, and null without one', () => {
    expect(identityName({ usernames: ['bbbbbbbasa.dash', 'b2.dash'] })).toBe('bbbbbbbasa.dash')
    expect(identityName({ usernames: [] })).toBeNull()
  })
})

describe('identityLabel', () => {
  it('prefers the oldest owned name, then the full identifier', () => {
    expect(identityLabel({ identifier: IDENTIFIER, usernames: ['bbbbbbbasa.dash', 'b2.dash'] })).toBe('bbbbbbbasa.dash')
    expect(identityLabel({ identifier: IDENTIFIER, usernames: [] })).toBe(IDENTIFIER)
  })
})
