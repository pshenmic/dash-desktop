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
