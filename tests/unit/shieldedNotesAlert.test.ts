import { describe, expect, it } from 'vitest'
import { newShieldedNotesTitle } from '../../src/renderer/src/utils/shieldedNotesAlert'

describe('newShieldedNotesTitle', () => {
  it('uses the singular noun for one note', () => {
    expect(newShieldedNotesTitle(1)).toBe('1 new note in the shielded pool')
  })

  it('uses the plural noun for several notes', () => {
    expect(newShieldedNotesTitle(2)).toBe('2 new notes in the shielded pool')
  })

  it('groups thousands', () => {
    expect(newShieldedNotesTitle(12345)).toBe('12,345 new notes in the shielded pool')
  })
})
