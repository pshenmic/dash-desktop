import {useLayoutEffect, useRef, useState} from 'react'
import {SCROLL_EDGE_THRESHOLD_PX} from '@renderer/constants/scrollIndicator'
import type {FadingScrollAreaProps} from '@renderer/types/FadingScrollArea'

export default function FadingScrollArea({children, className, enabled = true}: FadingScrollAreaProps): React.JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [hasMore, setHasMore] = useState(false)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!enabled || viewport === null) return
    const update = (): void => {
      setHasMore(viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > SCROLL_EDGE_THRESHOLD_PX)
    }
    update()
    viewport.addEventListener('scroll', update, {passive: true})
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    for (const child of Array.from(viewport.children)) observer.observe(child)
    return () => {
      viewport.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [children, enabled])

  return (
    <div
      ref={viewportRef}
      className={`${className} ${enabled && hasMore ? '[mask-image:linear-gradient(to_bottom,black_calc(100%_-_1.25rem),transparent)]' : ''}`}
    >
      {children}
    </div>
  )
}
