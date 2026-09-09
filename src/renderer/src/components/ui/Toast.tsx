import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ErrorIcon, ExclamationIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { Text } from '../dash-ui-kit-enxtended'
import { renderBoldText } from '@renderer/utils/renderBoldText'
import type { ToastItem, ToastVariant } from '@renderer/types/Toast'

let toasts: ToastItem[] = []
let nextId = 0
let listeners: Array<() => void> = []

function emitChange(): void {
  toasts = [...toasts]
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): ToastItem[] {
  return toasts
}

function addToast(variant: ToastVariant, text: string): void {
  toasts = [{ id: nextId++, variant, text }]
  emitChange()
}

function removeToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emitChange()
}


export const toast = {
  error: (text: string) => addToast('error', text),
  warning: (text: string) => addToast('warning', text),
}


const TOAST_DURATION = 5000
const ANIMATION_MS = 200

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const warning = item.variant === 'warning'

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
  }, [])

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(item.id), ANIMATION_MS)
  }, [item.id, onDismiss])

  useEffect(() => {
    const timer = setTimeout(dismiss, TOAST_DURATION)
    return () => clearTimeout(timer)
  }, [dismiss])

  const isShown = visible && !exiting

  return (
    <div
      role={warning ? 'status' : 'alert'}
      aria-live={warning ? 'polite' : 'assertive'}
      className={`
        flex items-start gap-3 p-3
        rounded-[.9375rem]
        border
        backdrop-blur-md
        shadow-[0_0_75px_0_rgba(0,0,0,0.1)]
        max-w-88
        cursor-pointer
        transition-all ease-out
        ${warning
          ? 'border-dash-orange/40 bg-dash-orange/15 dark:bg-dash-orange/20'
          : 'border-[rgba(205,46,0,0.24)] bg-[rgba(205,46,0,0.24)]'}
        ${isShown
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-8'}
      `}
      style={{ transitionDuration: `${ANIMATION_MS}ms` }}
      onClick={dismiss}
    >
      {warning
        ? (
          <span className="flex size-[1.6875rem] shrink-0 items-center justify-center rounded-full bg-dash-orange/20 text-dash-orange">
            <ExclamationIcon size={14} color="currentColor" />
          </span>
        )
        : <ErrorIcon size={27} className="shrink-0 rounded-full" />}
      <div className={"flex-1 min-w-0"}>
        <Text
          size={12}
          weight="medium"
          className={`leading-[120%] whitespace-pre-wrap ${warning ? 'text-dash-orange!' : 'text-white!'}`}
        >
          {renderBoldText(item.text)}
        </Text>
      </div>
    </div>
  )
}

export function ToastContainer(): React.JSX.Element | null {
  const items = useSyncExternalStore(subscribe, getSnapshot)

  const handleDismiss = useCallback((id: number) => {
    removeToast(id)
  }, [])

  if (items.length === 0) return null

  return createPortal(
    <div className={"fixed top-12 right-12 z-9999 flex flex-col gap-2"}>
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={handleDismiss} />
      ))}
    </div>,
    document.body
  )
}
