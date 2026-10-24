import { describe, expect, it } from 'vitest'
import { creditShortfall, feeShortfall, shortfallMessage } from '../../src/renderer/src/utils/dashPayShortfall'
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

describe('shortfallMessage', () => {
  it('words each shortfall', () => {
    expect(shortfallMessage({ kind: ShortfallKind.FeeError }, 'alice.dash')).toBe('Couldn’t get the fee')
    expect(shortfallMessage({ kind: ShortfallKind.Balance, missingCredits: 50_000_000_000n }, 'alice.dash'))
      .toBe('alice.dash needs 0.5 Dash more.')
    expect(shortfallMessage({ kind: ShortfallKind.Balance, missingCredits: 100_000_000_000n }, 'bob.dash'))
      .toBe('bob.dash needs 1 Dash more.')
  })
})
