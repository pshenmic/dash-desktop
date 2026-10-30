import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ElementSize } from '@renderer/types/ElementSize'

export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, ElementSize] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const update = (): void => {
      const { width, height } = element.getBoundingClientRect()
      if (width === 0) return
      setSize(current => current.width === width && current.height === height ? current : { width, height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element, { box: 'border-box' })
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}
