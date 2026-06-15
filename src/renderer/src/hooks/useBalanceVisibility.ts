import { useCallback, useSyncExternalStore } from 'react'

const LS_BALANCE_VISIBLE = 'wallet.balance.visible'

function readVisibility(): boolean {
  try {
    const saved = localStorage.getItem(LS_BALANCE_VISIBLE)
    return saved === null ? true : saved === 'true'
  } catch {
    return true
  }
}

let visible = readVisibility()
let listeners: Array<() => void> = []

function emit(): void {
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): boolean {
  return visible
}

function setVisibilityGlobal(next: boolean): void {
  visible = next
  try {
    localStorage.setItem(LS_BALANCE_VISIBLE, String(next))
  } catch {}
  emit()
}

export function useBalanceVisibility(): { isBalanceVisible: boolean; toggleBalanceVisibility: () => void } {
  const isBalanceVisible = useSyncExternalStore(subscribe, getSnapshot)
  const toggleBalanceVisibility = useCallback(() => setVisibilityGlobal(!visible), [])
  return { isBalanceVisible, toggleBalanceVisibility }
}
