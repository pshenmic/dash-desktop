import {LOCATOR_DENSE_HEIGHTS} from './constants'

// Heights for a `getheaders` locator, tip-first: every height for the most
// recent LOCATOR_DENSE_HEIGHTS blocks, then doubling steps down to `floor`.
//
// A single-hash locator is what wedges header sync across a reorg: the peer
// cannot find a common ancestor from a hash that left its active chain, and
// answers from genesis instead. The dense head covers shallow forks in one
// round trip; the doubling tail bounds the list at ~log2 of the range.
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
