import { describe, it, expect } from 'vitest'
import {maxSpendableCredits, selectableNotes, selectSpendNotes} from '../../src/main/src/utils/shieldedNoteSelection'
import {OwnedNote, SelectableNote, ShieldedSpendSource} from '../../src/main/src/types/ShieldedNoteSelection'
function note(index: number, value: bigint): SelectableNote {
  return { index, value }
}

const noFee = (): bigint => 0n

function owned(index: number, value: bigint, spent = false): OwnedNote {
  return { index, value, spent }
}

const picked = (...noteIndexes: number[]): ShieldedSpendSource => ({ kind: 'notes', noteIndexes })

describe('selectSpendNotes', () => {
  it('selects a single note covering the target', () => {
    const res = selectSpendNotes([note(0, 100n), note(1, 10n)], 50n, 6, noFee)
    expect(res).not.toBeNull()
    expect(res!.selected.map(n => n.index)).toEqual([0])
    expect(res!.total).toBe(100n)
  })

  it('picks largest notes first and stops once the target is covered', () => {
    const notes = [note(0, 10n), note(1, 50n), note(2, 30n), note(3, 20n)]
    const res = selectSpendNotes(notes, 70n, 6, noFee)
    expect(res!.selected.map(n => n.index)).toEqual([1, 2])
    expect(res!.total).toBe(80n)
  })

  it('never selects more than maxNotes', () => {
    const notes = Array.from({ length: 10 }, (_, i) => note(i, 10n))
    const res = selectSpendNotes(notes, 60n, 6, noFee)
    expect(res!.selected).toHaveLength(6)
    expect(res!.total).toBe(60n)
  })

  it('returns null when maxNotes largest notes cannot cover the target', () => {
    const notes = Array.from({ length: 10 }, (_, i) => note(i, 10n))
    expect(selectSpendNotes(notes, 61n, 6, noFee)).toBeNull()
  })

  it('returns null for an empty note set', () => {
    expect(selectSpendNotes([], 1n, 6, noFee)).toBeNull()
  })

  it('breaks value ties by ascending index deterministically', () => {
    const notes = [note(5, 10n), note(2, 10n), note(9, 10n)]
    const res = selectSpendNotes(notes, 20n, 6, noFee)
    expect(res!.selected.map(n => n.index)).toEqual([2, 5])
  })

  it('does not mutate the input array', () => {
    const notes = [note(0, 1n), note(1, 5n), note(2, 3n)]
    selectSpendNotes(notes, 5n, 6, noFee)
    expect(notes.map(n => n.index)).toEqual([0, 1, 2])
  })

  it('reserves the fee for the selected note count', () => {
    const fee = (count: number): bigint => BigInt(count) * 10n
    const res = selectSpendNotes([note(0, 60n), note(1, 30n)], 50n, 6, fee)
    expect(res!.selected.map(n => n.index)).toEqual([0])
    expect(res!.feeCredits).toBe(10n)
  })

  it('adds a note when the fee makes the first one insufficient', () => {
    const fee = (count: number): bigint => count === 1 ? 10n : 20n
    const res = selectSpendNotes([note(0, 100n), note(1, 50n)], 95n, 6, fee)
    expect(res!.selected.map(n => n.index)).toEqual([0, 1])
    expect(res!.feeCredits).toBe(20n)
  })

  it('returns null when the growing fee can never be covered', () => {
    const fee = (count: number): bigint => BigInt(count) * 100n
    expect(selectSpendNotes([note(0, 90n), note(1, 90n)], 1n, 6, fee)).toBeNull()
  })
})

describe('maxSpendableCredits', () => {
  it('sums the top maxNotes values minus the fee', () => {
    const notes = [note(0, 10n), note(1, 50n), note(2, 30n), note(3, 20n), note(4, 5n), note(5, 5n), note(6, 5n)]
    expect(maxSpendableCredits(notes, 6, () => 20n)).toBe(100n)
  })

  it('returns 0 when the fee exceeds the total', () => {
    expect(maxSpendableCredits([note(0, 5n)], 6, () => 10n)).toBe(0n)
  })

  it('returns 0 for an empty note set', () => {
    expect(maxSpendableCredits([], 6, () => 10n)).toBe(0n)
  })

  it('skips notes whose value is below their marginal fee', () => {
    const fee = (count: number): bigint => BigInt(count) * 50n
    expect(maxSpendableCredits([note(0, 100n), note(1, 5n)], 6, fee)).toBe(50n)
  })
})

describe('selectableNotes', () => {
  it('drops notes the wallet already spent', () => {
    const notes = [owned(0, 100n), owned(1, 50n, true), owned(2, 30n)]

    expect(selectableNotes(notes).map(n => n.index)).toEqual([0, 2])
  })

  it('narrows to the notes an address source names', () => {
    const notes = [owned(0, 100n), owned(1, 50n), owned(2, 30n)]

    expect(selectableNotes(notes, {kind: 'address', noteIndexes: [1, 2]}).map(n => n.index)).toEqual([1, 2])
  })

  // The address source only says where to draw from, so a spent note there is
  // one fewer candidate rather than a refusal.
  it('accepts an address source whose notes were partly spent', () => {
    const notes = [owned(0, 100n), owned(1, 50n, true)]

    expect(selectableNotes(notes, {kind: 'address', noteIndexes: [0, 1]}).map(n => n.index)).toEqual([0])
  })

  it('refuses a picked note that was spent since it was picked', () => {
    const notes = [owned(0, 100n), owned(1, 50n, true)]

    expect(() => selectableNotes(notes, picked(0, 1))).toThrow('no longer spendable')
  })

  it('refuses a picked note the wallet does not hold', () => {
    expect(() => selectableNotes([owned(0, 100n)], picked(0, 7))).toThrow('no longer spendable')
  })
})

describe('spending a picked set of notes', () => {
  // The automatic walk would have stopped at the first note covering the amount,
  // which is the one thing a picked set must not do.
  it('spends every picked note even when one of them would have covered the amount', () => {
    const res = selectSpendNotes([note(0, 100n), note(1, 50n)], 20n, 6, noFee, picked(0, 1))

    expect(res!.selected.map(n => n.index)).toEqual([0, 1])
    expect(res!.total).toBe(150n)
  })

  it('prices the whole pick, including a note the walk would have skipped', () => {
    const fee = (count: number): bigint => BigInt(count) * 10n
    const res = selectSpendNotes([note(0, 100n), note(1, 1n)], 20n, 6, fee, picked(0, 1))

    expect(res!.feeCredits).toBe(20n)
  })

  it('returns null when the pick cannot cover the amount and its fee', () => {
    const fee = (count: number): bigint => BigInt(count) * 10n

    expect(selectSpendNotes([note(0, 30n)], 25n, 6, fee, picked(0))).toBeNull()
  })

  it('returns null for a pick larger than the note limit', () => {
    const notes = Array.from({ length: 7 }, (_, i) => note(i, 10n))

    expect(selectSpendNotes(notes, 10n, 6, noFee, picked(0, 1, 2, 3, 4, 5, 6))).toBeNull()
  })

  it('returns null for an empty pick', () => {
    expect(selectSpendNotes([], 1n, 6, noFee, {kind: 'notes', noteIndexes: []})).toBeNull()
  })
})

describe('the most a picked set can spend', () => {
  it('is the picked total less the fee that count carries', () => {
    const fee = (count: number): bigint => BigInt(count) * 10n

    expect(maxSpendableCredits([note(0, 100n), note(1, 1n)], 6, fee, picked(0, 1))).toBe(81n)
  })

  it('leaves nothing over when the whole amount is spent', () => {
    const fee = (count: number): bigint => BigInt(count) * 10n
    const notes = [note(0, 100n), note(1, 1n)]
    const max = maxSpendableCredits(notes, 6, fee, picked(0, 1))
    const res = selectSpendNotes(notes, max, 6, fee, picked(0, 1))

    expect(res!.total - max - res!.feeCredits).toBe(0n)
  })

  it('is zero when the pick exceeds the note limit', () => {
    const notes = Array.from({ length: 7 }, (_, i) => note(i, 10n))

    expect(maxSpendableCredits(notes, 6, noFee, picked(0, 1, 2, 3, 4, 5, 6))).toBe(0n)
  })

  it('is zero when the fee outruns the picked total', () => {
    expect(maxSpendableCredits([note(0, 5n)], 6, () => 10n, picked(0))).toBe(0n)
  })
})
