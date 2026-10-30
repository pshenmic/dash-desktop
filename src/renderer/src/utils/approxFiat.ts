import { FIAT_APPROX_PREFIX } from '../constants/balance'

export function formatApproxFiat(fiat: string, currency?: string): string {
  if (currency === undefined) return `${FIAT_APPROX_PREFIX}${fiat}`
  return `${FIAT_APPROX_PREFIX}${fiat} ${currency.toUpperCase()}`
}
