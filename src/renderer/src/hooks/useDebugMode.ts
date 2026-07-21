import { useSyncExternalStore } from 'react'
import { readDebugMode, writeDebugMode } from '@renderer/utils/debugMode'

let enabled: boolean = readDebugMode()
let listeners: Array<() => void> = []

function emit(): void {
  for (const l of [...listeners]) l()
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): boolean {
  return enabled
}

export function setDebugMode(next: boolean): void {
  enabled = next
  writeDebugMode(next)
  emit()
}

export function useDebugMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
