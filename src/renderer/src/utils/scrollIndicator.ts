import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import {
  SCROLL_OVERFLOW_THRESHOLD_PX,
  MIN_THUMB_HEIGHT_PERCENT,
} from '../constants/scrollIndicator'

export interface ScrollMetrics {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}

export interface ScrollIndicatorState {
  canScroll: boolean
  thumbOffsetPercent: number
  thumbHeightPercent: number
}

export interface ScrollIndicatorController extends ScrollIndicatorState {
  isDragging: boolean
  trackRef: RefObject<HTMLDivElement | null>
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
}

export interface GrabMetrics {
  pointerY: number
  trackTop: number
  trackHeight: number
  thumbOffsetPercent: number
  thumbHeightPercent: number
}

export interface ThumbGrab {
  offset: number
  onThumb: boolean
}

export interface DragMetrics {
  pointerY: number
  trackTop: number
  trackHeight: number
  thumbHeightPercent: number
  grabOffset: number
  scrollHeight: number
  clientHeight: number
}

const FULL_PERCENT = 100

export function computeScrollIndicator({
  scrollTop,
  clientHeight,
  scrollHeight,
}: ScrollMetrics): ScrollIndicatorState {
  const overflow = scrollHeight - clientHeight
  if (clientHeight <= 0 || overflow <= SCROLL_OVERFLOW_THRESHOLD_PX) {
    return { canScroll: false, thumbOffsetPercent: 0, thumbHeightPercent: FULL_PERCENT }
  }
  const thumbHeightPercent = Math.max(
    MIN_THUMB_HEIGHT_PERCENT,
    (clientHeight / scrollHeight) * FULL_PERCENT,
  )
  const progress = Math.min(1, Math.max(0, scrollTop / overflow))
  const thumbOffsetPercent = progress * (FULL_PERCENT - thumbHeightPercent)
  return { canScroll: true, thumbOffsetPercent, thumbHeightPercent }
}

export function computeThumbGrab({
  pointerY,
  trackTop,
  trackHeight,
  thumbOffsetPercent,
  thumbHeightPercent,
}: GrabMetrics): ThumbGrab {
  const thumbHeight = (thumbHeightPercent / FULL_PERCENT) * trackHeight
  const thumbTop = (thumbOffsetPercent / FULL_PERCENT) * trackHeight
  const offset = pointerY - trackTop - thumbTop
  const onThumb = offset >= 0 && offset <= thumbHeight
  return { offset: onThumb ? offset : thumbHeight / 2, onThumb }
}

export function computeDragScrollTop({
  pointerY,
  trackTop,
  trackHeight,
  thumbHeightPercent,
  grabOffset,
  scrollHeight,
  clientHeight,
}: DragMetrics): number {
  const travel = trackHeight - (thumbHeightPercent / FULL_PERCENT) * trackHeight
  const overflow = scrollHeight - clientHeight
  if (travel <= 0 || overflow <= 0) return 0
  const progress = Math.min(1, Math.max(0, (pointerY - trackTop - grabOffset) / travel))
  return progress * overflow
}
