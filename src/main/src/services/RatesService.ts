import { net } from 'electron'
import {SUPPORTED_CURRENCIES} from "../constants";

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

const TTL_MS = 60_000
const REQUEST_TIMEOUT_MS = 8_000

function zeroRates(): ExchangeRates {
  return Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c, 0]))
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await net.fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function pickRates(raw: Record<string, number>, keyOf: (currency: string) => string): ExchangeRates {
  const rates: ExchangeRates = {}
  for (const currency of SUPPORTED_CURRENCIES) {
    const value = raw[keyOf(currency)]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      rates[currency] = value
    }
  }
  return rates
}

function pickChanges(raw: Record<string, number>, keyOf: (currency: string) => string): ExchangeRates {
  const changes: ExchangeRates = {}
  for (const currency of SUPPORTED_CURRENCIES) {
    const value = raw[keyOf(currency)]
    if (typeof value === 'number' && Number.isFinite(value)) {
      changes[currency] = value
    }
  }
  return changes
}

export class CoinGeckoRateProvider implements RateProvider {
  readonly name = 'coingecko'
  private readonly url =
    'https://api.coingecko.com/api/v3/simple/price' +
    `?ids=dash&vs_currencies=${SUPPORTED_CURRENCIES.join(',')}` +
    '&include_24hr_change=true'

  async fetchRates(): Promise<ProviderRates> {
    const data = (await fetchJson(this.url)) as { dash?: Record<string, number> }
    const dash = data.dash
    if (!dash || typeof dash !== 'object') {
      throw new Error('CoinGecko response missing dash prices')
    }
    return {
      rates: pickRates(dash, (c) => c),
      changes24h: pickChanges(dash, (c) => `${c}_24h_change`),
    }
  }
}

export class CryptoCompareRateProvider implements RateProvider {
  readonly name = 'cryptocompare'
  private readonly url =
    'https://min-api.cryptocompare.com/data/price' +
    `?fsym=DASH&tsyms=${SUPPORTED_CURRENCIES.map((c) => c.toUpperCase()).join(',')}`

  async fetchRates(): Promise<ProviderRates> {
    const data = (await fetchJson(this.url)) as Record<string, number> & {
      Response?: string
      Message?: string
    }
    if (data.Response === 'Error') {
      throw new Error(`CryptoCompare: ${data.Message ?? 'unknown error'}`)
    }
    return { rates: pickRates(data, (c) => c.toUpperCase()), changes24h: {} }
  }
}

export class RatesService {
  private cache: ProviderRates | null = null
  private fetchedAt: number | null = null
  private inflight: Promise<ProviderRates> | null = null
  private readonly providers: RateProvider[]
  private readonly ttlMs: number

  constructor(providers?: RateProvider[], ttlMs: number = TTL_MS) {
    this.providers =
      providers != null && providers.length > 0
        ? providers
        : [new CoinGeckoRateProvider(), new CryptoCompareRateProvider()]
    this.ttlMs = ttlMs
  }

  async getRates(): Promise<ExchangeRatesResult> {
    const fresh =
      this.cache !== null &&
      this.fetchedAt !== null &&
      Date.now() - this.fetchedAt < this.ttlMs

    if (fresh) {
      return { ...this.cache!, updatedAt: this.fetchedAt, stale: false }
    }

    try {
      const rates = await this.refresh()
      return { ...rates, updatedAt: this.fetchedAt, stale: false }
    } catch (err) {
      console.error('[rates] refresh failed:', err)
      return {
        rates: this.cache?.rates ?? zeroRates(),
        changes24h: this.cache?.changes24h ?? {},
        updatedAt: this.fetchedAt,
        stale: true,
      }
    }
  }

  private refresh(): Promise<ProviderRates> {
    if (this.inflight) return this.inflight

    this.inflight = this.fetchFromProviders()
      .then((rates) => {
        this.cache = rates
        this.fetchedAt = Date.now()
        return rates
      })
      .finally(() => {
        this.inflight = null
      })

    return this.inflight
  }

  private async fetchFromProviders(): Promise<ProviderRates> {
    const errors: string[] = []

    for (const provider of this.providers) {
      try {
        const rates = await provider.fetchRates()
        if (Object.keys(rates.rates).length === 0) {
          errors.push(`${provider.name}: empty rates`)
          continue
        }
        return rates
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${provider.name}: ${msg}`)
      }
    }

    throw new Error(`All rate providers failed: ${errors.join('; ')}`)
  }
}
