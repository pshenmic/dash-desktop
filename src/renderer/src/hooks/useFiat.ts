import { useCallback, useSyncExternalStore } from 'react'
import { API } from '@renderer/api'
import { useRates } from './useRates'
import { formatDuffsAsFiat } from '@renderer/utils/fiat'

const LS_DISPLAY_CURRENCY = 'wallet.display.currency'
const DEFAULT_CURRENCY = 'usd'

function readCachedCurrency(): string {
  try {
    return localStorage.getItem(LS_DISPLAY_CURRENCY) ?? DEFAULT_CURRENCY
  } catch {
    return DEFAULT_CURRENCY
  }
}

let currency: string = readCachedCurrency()
let listeners: Array<() => void> = []
let hydrated = false
let userChanged = false

function emit(): void {
  for (const l of listeners) l()
}

function persist(next: string): void {
  try {
    localStorage.setItem(LS_DISPLAY_CURRENCY, next)
  } catch {
    return
  }
}

function hydrateOnce(): void {
  if (hydrated) return
  hydrated = true
  API.getPreferences()
    .then((prefs) => {
      if (userChanged) return
      const stored = prefs?.general?.currency
      if (stored && stored !== currency) {
        currency = stored
        persist(stored)
        emit()
      }
    })
    .catch(() => {})
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  hydrateOnce()
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): string {
  return currency
}

function setCurrencyGlobal(next: string): void {
  userChanged = true
  currency = next
  persist(next)
  emit()
  API.setFiatCurrency(next).catch((e) => console.error('setFiatCurrency failed', e))
}

export interface UseFiat {
  currency: string
  rateReady: boolean
  setCurrency: (currency: string) => void
  format: (duffs: bigint) => string
}

export function useFiat(): UseFiat {
  const ratesResult = useRates()
  const activeCurrency = useSyncExternalStore(subscribe, getSnapshot)

  const setCurrency = useCallback((next: string) => setCurrencyGlobal(next), [])

  const rate = ratesResult.rates[activeCurrency] ?? 0
  const rateReady = rate > 0

  const format = useCallback(
    (duffs: bigint) => formatDuffsAsFiat(duffs, rate, activeCurrency),
    [rate, activeCurrency],
  )

  return {
    currency: activeCurrency,
    rateReady,
    setCurrency,
    format,
  }
}
