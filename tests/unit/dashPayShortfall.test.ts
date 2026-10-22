import { describe, expect, it } from 'vitest'
import { creditShortfall, feeShortfall, keysShortfall, shortfallMessage } from '../../src/renderer/src/utils/dashPayShortfall'
import { ShortfallKind } from '../../src/renderer/src/enums/DashPay'

describe('creditShortfall', () => {
  it('returns the missing credits only when the balance cannot cover the fee', () => {
    expect(creditShortfall(100n, 250n)).toBe(150n)
    expect(creditShortfall(250n, 250n)).toBeNull()
    expect(creditShortfall(300n, 250n)).toBeNull()
    expect(creditShortfall(0n, null)).toBeNull()
  })
})

describe('feeShortfall', () => {
  it('reports a fee error before the balance', () => {
    expect(feeShortfall(true, 0n, null)).toEqual({ kind: ShortfallKind.FeeError })
    expect(feeShortfall(true, 0n, 250n)).toEqual({ kind: ShortfallKind.FeeError })
  })

  it('reports how many credits are missing', () => {
    expect(feeShortfall(false, 100n, 250n)).toEqual({ kind: ShortfallKind.Balance, missingCredits: 150n })
  })

  it('is null when the fee is unknown or covered', () => {
    expect(feeShortfall(false, 100n, null)).toBeNull()
    expect(feeShortfall(false, 250n, 250n)).toBeNull()
  })
})

describe('keysShortfall', () => {
  const base = { requested: 2, slotsLeft: 16, feeCredits: 1_000n, feeError: null, balance: 5_000n }

  it('is null when the identity can pay and has room', () => {
    expect(keysShortfall(base)).toBeNull()
    expect(keysShortfall({ ...base, feeCredits: null })).toBeNull()
    expect(keysShortfall({ ...base, balance: 1_000n })).toBeNull()
  })

  it('reports missing slots before anything else', () => {
    expect(keysShortfall({ ...base, requested: 3, slotsLeft: 2, feeError: 'Failed' })).toEqual({ kind: ShortfallKind.Slots, slotsLeft: 2 })
  })

  it('reports a fee error before the balance', () => {
    expect(keysShortfall({ ...base, feeError: 'Failed', balance: 0n })).toEqual({ kind: ShortfallKind.FeeError })
  })

  it('reports how many credits are missing', () => {
    expect(keysShortfall({ ...base, balance: 400n })).toEqual({ kind: ShortfallKind.Balance, missingCredits: 600n })
  })
})

describe('shortfallMessage', () => {
  it('words each shortfall', () => {
    expect(shortfallMessage({ kind: ShortfallKind.Slots, slotsLeft: 1 }, 'alice.dash')).toBe('Only 1 key slot left.')
    expect(shortfallMessage({ kind: ShortfallKind.FeeError }, 'alice.dash')).toBe('Couldn’t get the fee')
    expect(shortfallMessage({ kind: ShortfallKind.Balance, missingCredits: 50_000_000_000n }, 'alice.dash'))
      .toBe('alice.dash needs 0.5 Dash more.')
    expect(shortfallMessage({ kind: ShortfallKind.Balance, missingCredits: 100_000_000_000n }, 'bob.dash'))
      .toBe('bob.dash needs 1 Dash more.')
  })
})
