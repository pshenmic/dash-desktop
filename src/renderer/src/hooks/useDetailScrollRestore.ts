import { useLayoutEffect, useRef } from 'react'
import { SCROLL_CONTAINER_ID } from '@renderer/constants/scrollIndicator'

export function useDetailScrollRestore(detailKey: string | null): () => void {
  const listScrollTop = useRef<number | null>(null)

  useLayoutEffect(() => {
    const container = document.getElementById(SCROLL_CONTAINER_ID)
    if (container === null) return
    if (detailKey !== null) {
      container.scrollTop = 0
      return
    }
    if (listScrollTop.current === null) return
    container.scrollTop = listScrollTop.current
    listScrollTop.current = null
  }, [detailKey])

  return () => {
    listScrollTop.current = document.getElementById(SCROLL_CONTAINER_ID)?.scrollTop ?? null
  }
}
