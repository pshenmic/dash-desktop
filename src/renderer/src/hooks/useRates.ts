import { useSyncExternalStore } from 'react'
import { API } from '@renderer/api'
import { ExchangeRatesResult } from '@renderer/api/types'

const REFRESH_MS = 60_000

let snapshot: ExchangeRatesResult = { rates: {}, updatedAt: null, stale: true }
let listeners: Array<() => void> = []
let timer: ReturnType<typeof setInterval> | null = null
let started = false

function emit(): void {
  for (const l of listeners) l()
}

function refresh(): void {
  API.getExchangeRates()
    .then((next) => {
      snapshot = next
      emit()
    })
    .catch((e) => console.error('[rates] fetch failed:', e))
}

function ensureStarted(): void {
  if (started) return
  started = true
  refresh()
  timer = setInterval(refresh, REFRESH_MS)
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  ensureStarted()
  return () => {
    listeners = listeners.filter((l) => l !== listener)
    if (listeners.length === 0 && timer) {
      clearInterval(timer)
      timer = null
      started = false
    }
  }
}

function getSnapshot(): ExchangeRatesResult {
  return snapshot
}

export function useRates(): ExchangeRatesResult {
  return useSyncExternalStore(subscribe, getSnapshot)
}
