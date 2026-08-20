import {LOCATOR_DENSE_HEIGHTS} from '../constants'

// Tip-first locator heights: dense over the most recent blocks, then doubling
// down to `floor`. A peer cannot find a common ancestor from a lone hash that
// left its active chain, and answers from genesis instead.
export function buildLocatorHeights(tipHeight: number, floorHeight: number): number[] {
  const floor = Math.max(1, floorHeight)
  if (tipHeight < floor) return [floor]

  const heights: number[] = []
  let height = tipHeight
  let step = 1

  while (height > floor) {
    heights.push(height)
    if (heights.length >= LOCATOR_DENSE_HEIGHTS) step *= 2
    height -= step
  }
  heights.push(floor)

  return heights
}
