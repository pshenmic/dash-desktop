import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  computeDragScrollTop,
  computeScrollIndicator,
  computeThumbGrab,
  ScrollIndicatorController,
  ScrollIndicatorState,
} from '@renderer/utils/scrollIndicator'

export function useScrollIndicator(containerId: string): ScrollIndicatorController {
  const [state, setState] = useState<ScrollIndicatorState>(() =>
    computeScrollIndicator({ scrollTop: 0, clientHeight: 0, scrollHeight: 0 })
  )
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const grabOffsetRef = useRef(0)
  const pointerYRef = useRef(0)

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

  const scrollToPointer = (pointerY: number, behavior: ScrollBehavior): void => {
    const track = trackRef.current
    const container = document.getElementById(containerId)
    if (!track || !container) return
    const rect = track.getBoundingClientRect()
    container.scrollTo({
      behavior,
      top: computeDragScrollTop({
        pointerY,
        trackTop: rect.top,
        trackHeight: rect.height,
        thumbHeightPercent: state.thumbHeightPercent,
        grabOffset: grabOffsetRef.current,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
      }),
    })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    const track = trackRef.current
    if (!state.canScroll || !track) return
    const rect = track.getBoundingClientRect()
    const grab = computeThumbGrab({
      pointerY: event.clientY,
      trackTop: rect.top,
      trackHeight: rect.height,
      thumbOffsetPercent: state.thumbOffsetPercent,
      thumbHeightPercent: state.thumbHeightPercent,
    })
    grabOffsetRef.current = grab.offset
    pointerYRef.current = event.clientY
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    if (!grab.onThumb) scrollToPointer(event.clientY, 'smooth')
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    if (!isDragging || event.clientY === pointerYRef.current) return
    pointerYRef.current = event.clientY
    scrollToPointer(event.clientY, 'auto')
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDragging(false)
  }

  return { ...state, isDragging, trackRef, onPointerDown, onPointerMove, onPointerUp }
}
