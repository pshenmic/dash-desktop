import {describe, expect, it} from 'vitest'
import {fiatFieldParts} from '../../src/renderer/src/utils/fiatField'

describe('fiatFieldParts', () => {
  it('splits the currency symbol off a formatted amount and marks it approximate', () => {
    expect(fiatFieldParts('$364.75', 'usd')).toEqual({symbol: '$', value: '~ 364.75'})
    expect(fiatFieldParts('€1,024.00', 'EUR')).toEqual({symbol: '€', value: '~ 1,024.00'})
  })

  it('shows zero while there is no amount', () => {
    expect(fiatFieldParts(null, 'usd')).toEqual({symbol: '$', value: '0'})
  })

  it('falls back to the currency code when it has no symbol', () => {
    expect(fiatFieldParts('12.00', 'gbp')).toEqual({symbol: 'GBP', value: '~ 12.00'})
  })
})
