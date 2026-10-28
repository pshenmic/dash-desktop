import { describe, expect, it } from 'vitest'
import {
  exactUsernameMatch,
  fullDpnsName,
  isContestedLabel,
  matchesIdentityQuery,
  normalizeDpnsLabel,
  stripDpnsInput,
  validateDpnsLabel,
} from '../../src/renderer/src/utils/dpnsLabel'
import { DpnsLabelIssue, DpnsLabelKind } from '../../src/renderer/src/enums/DashPay'

const PROTOCOL_LABEL = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/
const NORMALIZED_LABEL = /^[a-hj-km-np-z0-9][a-hj-km-np-z0-9-]{0,61}[a-hj-km-np-z0-9]$/

describe('stripDpnsInput', () => {
  it('drops a leading @, a trailing .dash and every whitespace', () => {
    expect(stripDpnsInput(' @Alice.dash ')).toBe('Alice')
    expect(stripDpnsInput('al ice')).toBe('alice')
    expect(stripDpnsInput('BOB.DASH')).toBe('BOB')
  })

  it('removes only one handle prefix and keeps a .dash that is not the suffix', () => {
    expect(stripDpnsInput('@@x')).toBe('@x')
    expect(stripDpnsInput('my.dashboard')).toBe('my.dashboard')
  })
})

describe('normalizeDpnsLabel', () => {
  it('lowercases and maps o, i and l to their homograph digits', () => {
    expect(normalizeDpnsLabel('Alice')).toBe('a11ce')
    expect(normalizeDpnsLabel('OIL')).toBe('011')
    expect(normalizeDpnsLabel('bob-42')).toBe('b0b-42')
  })

  it('treats every homograph spelling as one name', () => {
    const spellings = ['alice', 'ALICE', 'a1ice', 'aIice', 'aLice']
    expect(new Set(spellings.map(normalizeDpnsLabel))).toEqual(new Set(['a11ce']))
  })

  it('never leaves i, l or o in a normalized valid label', () => {
    for (const label of ['Olivia', 'lollipop', 'io-io', 'Bill2']) {
      expect(normalizeDpnsLabel(label)).toMatch(NORMALIZED_LABEL)
    }
  })
})

describe('validateDpnsLabel', () => {
  it('reports the first failing rule in the documented order', () => {
    expect(validateDpnsLabel('ab').issue).toBe(DpnsLabelIssue.TooShort)
    expect(validateDpnsLabel('a_').issue).toBe(DpnsLabelIssue.TooShort)
    expect(validateDpnsLabel('-a').issue).toBe(DpnsLabelIssue.TooShort)
    expect(validateDpnsLabel(`${'a'.repeat(63)}_`).issue).toBe(DpnsLabelIssue.TooLong)
    expect(validateDpnsLabel('a'.repeat(64)).issue).toBe(DpnsLabelIssue.TooLong)
    expect(validateDpnsLabel('ab_c').issue).toBe(DpnsLabelIssue.InvalidChars)
    expect(validateDpnsLabel('-ab_').issue).toBe(DpnsLabelIssue.InvalidChars)
    expect(validateDpnsLabel('-abc').issue).toBe(DpnsLabelIssue.EdgeHyphen)
    expect(validateDpnsLabel('abc-').issue).toBe(DpnsLabelIssue.EdgeHyphen)
  })

  it('accepts double hyphens and the length bounds, matching the protocol pattern', () => {
    for (const label of ['a--b', 'abc', 'a'.repeat(63), 'Alice', '0x1337']) {
      const check = validateDpnsLabel(label)
      expect(check.issue).toBeNull()
      expect(check.label).toMatch(PROTOCOL_LABEL)
    }
  })

  it('validates the stripped label and returns its normalized form and kind', () => {
    expect(validateDpnsLabel('@Alice.dash')).toEqual({
      issue: null,
      label: 'Alice',
      normalized: 'a11ce',
      kind: DpnsLabelKind.Contested,
    })
    expect(validateDpnsLabel('alice2').kind).toBe(DpnsLabelKind.Instant)
  })
})

describe('isContestedLabel', () => {
  it('flags 3–19 character names of letters, 0, 1 and hyphens after normalization', () => {
    expect(isContestedLabel('bob')).toBe(true)
    expect(isContestedLabel('carol01')).toBe(true)
    expect(isContestedLabel('quantum-explorer')).toBe(true)
    expect(isContestedLabel('Lol')).toBe(true)
    expect(isContestedLabel('a'.repeat(19))).toBe(true)
  })

  it('treats a digit from 2 to 9 or a 20+ character name as instant', () => {
    expect(isContestedLabel('alice2')).toBe(false)
    expect(isContestedLabel('abc9')).toBe(false)
    expect(isContestedLabel('a'.repeat(20))).toBe(false)
  })
})

describe('exactUsernameMatch', () => {
  const results = [
    { identifier: 'id-alicex', name: 'alicex.dash' },
    { identifier: 'id-alice', name: 'A1ice.dash' },
  ]

  it('finds the result whose label normalizes to the same name', () => {
    expect(exactUsernameMatch(results, 'alice')?.identifier).toBe('id-alice')
    expect(exactUsernameMatch(results, 'ALICE.dash')?.identifier).toBe('id-alice')
  })

  it('returns null when only prefixes match', () => {
    expect(exactUsernameMatch(results, 'ali')).toBeNull()
  })
})

describe('fullDpnsName', () => {
  it('appends the dash parent domain, keeping the casing', () => {
    expect(fullDpnsName('Alice')).toBe('Alice.dash')
  })
})

describe('matchesIdentityQuery', () => {
  it('matches every name homograph-insensitively and the identifier case-sensitively', () => {
    expect(matchesIdentityQuery('8xM4kQ', ['a1ice.dash', 'bob.dash'], 'ALI')).toBe(true)
    expect(matchesIdentityQuery('8xM4kQ', ['a1ice.dash', 'bob.dash'], '@bob.dash')).toBe(true)
    expect(matchesIdentityQuery('8xM4kQ', [], 'M4k')).toBe(true)
    expect(matchesIdentityQuery('8xM4kQ', [], 'm4k')).toBe(false)
  })

  it('does not match the .dash suffix every name carries', () => {
    expect(matchesIdentityQuery('8xM4kQ', ['alice.dash'], 'da')).toBe(false)
    expect(matchesIdentityQuery('8xM4kQ', ['dave.dash'], 'da')).toBe(true)
  })

  it('matches everything for an empty query and ignores missing names', () => {
    expect(matchesIdentityQuery('id', [null], '  ')).toBe(true)
    expect(matchesIdentityQuery('id', [null], 'carol')).toBe(false)
  })
})
