import { useEffect, useSyncExternalStore } from 'react'
import {
  ZoomPreference,
  readZoomPreference,
  writeZoomPreference,
  zoomFactor,
} from '@renderer/utils/zoom'

let preference: ZoomPreference = readZoomPreference()
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

function getSnapshot(): ZoomPreference {
  return preference
}

export function setZoomPreference(next: ZoomPreference): void {
  preference = next
  writeZoomPreference(next)
  emit()
}

export function useZoomPreference(): ZoomPreference {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function ZoomController(): null {
  const zoom = useZoomPreference()

  useEffect(() => {
    window.electron.webFrame.setZoomFactor(zoomFactor(zoom))
  }, [zoom])

  return null
}
