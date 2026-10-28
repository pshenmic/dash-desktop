import { ALLOCATION_EMPTY_VALUE } from '../constants/allocationAmountRow'
import type { FiatFieldParts } from '../types/AllocationAmountRow'
import { formatApproxFiat } from './approxFiat'
import { currencySymbol } from './fiat'

export function fiatFieldParts(formatted: string | null, currency: string): FiatFieldParts {
  const symbol = currencySymbol(currency) || currency.toUpperCase()
  if (formatted == null) return {symbol, value: ALLOCATION_EMPTY_VALUE}
  return {symbol, value: formatApproxFiat(formatted.startsWith(symbol) ? formatted.slice(symbol.length) : formatted)}
}
