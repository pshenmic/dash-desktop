import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { SCROLL_CONTAINER_ID } from '@renderer/constants/scrollIndicator'
import { TRANSACTIONS_SENTINEL_ROOT_MARGIN } from '@renderer/constants/transactionsPage'

export function useScrollEndSentinel(enabled: boolean, onReach: () => void, revision: number): RefObject<HTMLButtonElement | null> {
  const ref = useRef<HTMLButtonElement>(null)
  const onReachRef = useRef(onReach)
  onReachRef.current = onReach

  useEffect(() => {
    const sentinel = ref.current
    if (!enabled || sentinel === null) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      onReachRef.current()
    }, { root: document.getElementById(SCROLL_CONTAINER_ID), rootMargin: TRANSACTIONS_SENTINEL_ROOT_MARGIN })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [enabled, revision])

  return ref
}
