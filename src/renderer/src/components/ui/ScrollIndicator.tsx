import React from 'react'
import { useScrollIndicator } from '@renderer/hooks/useScrollIndicator'
import { SCROLL_CONTAINER_ID } from '@renderer/constants/scrollIndicator'

export default function ScrollIndicator(): React.JSX.Element {
  const {
    canScroll,
    thumbOffsetPercent,
    thumbHeightPercent,
    isDragging,
    trackRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = useScrollIndicator(SCROLL_CONTAINER_ID)

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`
        group fixed right-3 top-1/2 -translate-y-1/2 z-50
        h-16 w-3.5 rounded-full p-1
        bg-dash-primary-dark-blue/8 dark:bg-white/10
        touch-none select-none
        transition-opacity duration-300
        ${canScroll ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      `}
    >
      <div ref={trackRef} className={"relative h-full w-full"}>
        <div
          className={`
            absolute w-full rounded-full transition-colors
            ${isDragging
              ? 'bg-dash-primary-dark-blue/60 dark:bg-white/90'
              : 'bg-dash-primary-dark-blue/35 dark:bg-white/60 group-hover:bg-dash-primary-dark-blue/60 dark:group-hover:bg-white/90'}
          `}
          style={{ top: `${thumbOffsetPercent}%`, height: `${thumbHeightPercent}%` }}
        />
      </div>
    </div>
  )
}
