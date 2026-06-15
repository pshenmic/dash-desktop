import { useSyncExternalStore } from 'react'
import { API } from '@renderer/api'
import { WalletDto } from '@renderer/api/types'

let snapshot: WalletDto[] = []
let listeners: Array<() => void> = []

function emit(): void {
  for (const l of listeners) l()
}

export function refreshWallets(): void {
  API.getAllWallets()
    .then((data) => {
      snapshot = (data ?? []) as WalletDto[]
      emit()
    })
    .catch((e) => console.error('[wallets] fetch failed:', e))
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): WalletDto[] {
  return snapshot
}

export function useWallets(): WalletDto[] {
  return useSyncExternalStore(subscribe, getSnapshot)
}
