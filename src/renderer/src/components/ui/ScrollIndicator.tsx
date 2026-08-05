import React from 'react'
import { useScrollIndicator } from '@renderer/hooks/useScrollIndicator'
import { SCROLL_CONTAINER_ID } from '@renderer/constants/scrollIndicator'

export default function ScrollIndicator(): React.JSX.Element {
  const { canScroll, thumbOffsetPercent, thumbHeightPercent } =
    useScrollIndicator(SCROLL_CONTAINER_ID)

  return (
    <div
      className={`
        fixed right-3 top-1/2 -translate-y-1/2 z-50
        h-16 w-3.5 rounded-full p-1
        bg-dash-primary-dark-blue/8 dark:bg-white/10
        pointer-events-none
        transition-opacity duration-300
        ${canScroll ? 'opacity-100' : 'opacity-0'}
      `}
    >
      <div
        className={"relative w-full rounded-full bg-dash-primary-dark-blue/35 dark:bg-white/60"}
        style={{ top: `${thumbOffsetPercent}%`, height: `${thumbHeightPercent}%` }}
      />
    </div>
  )
}
