import {describe, expect, it} from 'vitest'
import {
  corePaymentUri,
  receiveAmountParam,
  receiveInvoiceHeadline,
  wrapByWidth,
} from '../../src/renderer/src/utils/receiveInvoice'

describe('receiveAmountParam', () => {
  it.each([
    ['', null],
    ['.', null],
    ['0', null],
    ['0.000', null],
    ['1.', '1'],
    ['.5', '0.5'],
    ['007.50', '7.5'],
    ['12.34567890', '12.3456789'],
  ])('normalises %j to %j', (amount, expected) => {
    expect(receiveAmountParam(amount)).toBe(expected)
  })

  it('refuses amounts with more than eight decimals or stray characters', () => {
    expect(receiveAmountParam('1.123456789')).toBeNull()
    expect(receiveAmountParam('1.2.3')).toBeNull()
    expect(receiveAmountParam('1e5')).toBeNull()
  })
})

describe('corePaymentUri', () => {
  it('adds the amount only when one is requested', () => {
    expect(corePaymentUri('yAddress', null)).toBe('dash:yAddress')
    expect(corePaymentUri('yAddress', '1.5')).toBe('dash:yAddress?amount=1.5')
  })
})

describe('receiveInvoiceHeadline', () => {
  it('asks for the amount, or for any amount when none is set', () => {
    expect(receiveInvoiceHeadline('1.5')).toBe('Pay 1.5 Dash')
    expect(receiveInvoiceHeadline(null)).toBe('Any amount')
  })
})

describe('wrapByWidth', () => {
  const width = (line: string): number => line.length

  it('breaks an unspaced address into lines that fit, keeping every character', () => {
    const lines = wrapByWidth([...'abcdefghij'], 4, width)
    expect(lines).toEqual(['abcd', 'efgh', 'ij'])
    expect(lines.join('')).toBe('abcdefghij')
  })

  it('breaks words between words and trims the spaces at the breaks', () => {
    expect(wrapByWidth('Pay 1.5 Dash'.split(/(?<= )/), 8, width)).toEqual(['Pay 1.5', 'Dash'])
  })

  it('keeps a single unit that is wider than the line on its own line', () => {
    expect(wrapByWidth(['abcdef', 'gh'], 4, width)).toEqual(['abcdef', 'gh'])
  })

  it('returns no lines for empty text', () => {
    expect(wrapByWidth([], 4, width)).toEqual([])
  })
})
