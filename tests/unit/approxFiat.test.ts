import { describe, it, expect } from 'vitest'
import { formatApproxFiat } from '../../src/renderer/src/utils/approxFiat'

describe('formatApproxFiat', () => {
  it('prefixes the formatted value with a tilde', () => {
    expect(formatApproxFiat('$0.53')).toBe('~ $0.53')
  })

  it('appends the upper-cased currency code when given', () => {
    expect(formatApproxFiat('$9,621.00', 'usd')).toBe('~ $9,621.00 USD')
    expect(formatApproxFiat('₿0.00012000', 'btc')).toBe('~ ₿0.00012000 BTC')
  })
})
