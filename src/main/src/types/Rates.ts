export type ExchangeRates = Record<string, number>

export interface ProviderRates {
  rates: ExchangeRates
  changes24h: ExchangeRates
}

export interface ExchangeRatesResult {
  rates: ExchangeRates
  changes24h: ExchangeRates
  updatedAt: number | null
  stale: boolean
}

export interface RateProvider {
  readonly name: string
  fetchRates(): Promise<ProviderRates>
}