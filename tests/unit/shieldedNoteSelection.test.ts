import { describe, it, expect } from 'vitest'
import {
  selectSpendNotes,
  maxSpendableCredits,
  SelectableNote,
} from '../../src/main/src/services/shieldedNoteSelection'

function note(index: number, value: bigint): SelectableNote {
  return { index, value }
}

describe('selectSpendNotes', () => {
  it('selects a single note covering the target', () => {
    const res = selectSpendNotes([note(0, 100n), note(1, 10n)], 50n, 6)
    expect(res).not.toBeNull()
    expect(res!.selected.map(n => n.index)).toEqual([0])
    expect(res!.total).toBe(100n)
  })

  it('picks largest notes first and stops once the target is covered', () => {
    const notes = [note(0, 10n), note(1, 50n), note(2, 30n), note(3, 20n)]
    const res = selectSpendNotes(notes, 70n, 6)
    expect(res!.selected.map(n => n.index)).toEqual([1, 2])
    expect(res!.total).toBe(80n)
  })

  it('never selects more than maxNotes', () => {
    const notes = Array.from({ length: 10 }, (_, i) => note(i, 10n))
    const res = selectSpendNotes(notes, 60n, 6)
    expect(res!.selected).toHaveLength(6)
    expect(res!.total).toBe(60n)
  })

  it('returns null when maxNotes largest notes cannot cover the target', () => {
    const notes = Array.from({ length: 10 }, (_, i) => note(i, 10n))
    expect(selectSpendNotes(notes, 61n, 6)).toBeNull()
  })

  it('returns null for an empty note set', () => {
    expect(selectSpendNotes([], 1n, 6)).toBeNull()
  })

  it('breaks value ties by ascending index deterministically', () => {
    const notes = [note(5, 10n), note(2, 10n), note(9, 10n)]
    const res = selectSpendNotes(notes, 20n, 6)
    expect(res!.selected.map(n => n.index)).toEqual([2, 5])
  })

  it('does not mutate the input array', () => {
    const notes = [note(0, 1n), note(1, 5n), note(2, 3n)]
    selectSpendNotes(notes, 5n, 6)
    expect(notes.map(n => n.index)).toEqual([0, 1, 2])
  })
})

describe('maxSpendableCredits', () => {
  it('sums the top maxNotes values minus the fee', () => {
    const notes = [note(0, 10n), note(1, 50n), note(2, 30n), note(3, 20n), note(4, 5n), note(5, 5n), note(6, 5n)]
    expect(maxSpendableCredits(notes, 6, 20n)).toBe(100n)
  })

  it('returns 0 when the fee exceeds the total', () => {
    expect(maxSpendableCredits([note(0, 5n)], 6, 10n)).toBe(0n)
  })

  it('returns 0 for an empty note set', () => {
    expect(maxSpendableCredits([], 6, 10n)).toBe(0n)
  })
})
