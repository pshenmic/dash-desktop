import { useEffect, useState } from 'react'
import { computeScrollIndicator, ScrollIndicatorState } from '@renderer/utils/scrollIndicator'

export function useScrollIndicator(containerId: string): ScrollIndicatorState {
  const [state, setState] = useState<ScrollIndicatorState>(() =>
    computeScrollIndicator({ scrollTop: 0, clientHeight: 0, scrollHeight: 0 })
  )

  useEffect(() => {
    const container = document.getElementById(containerId)
    if (!container) return

    const update = (): void => {
      setState(
        computeScrollIndicator({
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
        })
      )
    }

    update()
    container.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(container)
    for (const child of Array.from(container.children)) {
      observer.observe(child)
    }
    return () => {
      container.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [containerId])

  return state
}
