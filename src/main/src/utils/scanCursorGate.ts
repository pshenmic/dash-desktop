// The cfilter scan cursor is the wallet's resume marker: whatever it has
// passed is never rescanned, and advanceCursor uses MAX semantics so a cursor
// that moved too far cannot be walked back. getUtxos reads SQL only, so a
// block whose write failed while the cursor moved past it leaves confirmed
// coins invisible and unspendable with no signal to the user.
//
// This tracks the heights whose write failed permanently and caps how far the
// cursor may move, so the next scan re-covers the gap.
export class ScanCursorGate {
  private failed = new Map<string, Set<number>>()

  fail (walletId: string, height: number): void {
    const heights = this.failed.get(walletId) ?? new Set<number>()
    heights.add(height)
    this.failed.set(walletId, heights)
  }

  // A height that later landed (a rewind rescan re-applies it) stops holding
  // the cursor back.
  succeed (walletId: string, height: number): void {
    const heights = this.failed.get(walletId)
    if (heights == null) return
    heights.delete(height)
    if (heights.size === 0) this.failed.delete(walletId)
  }

  clear (walletId: string): void {
    this.failed.delete(walletId)
  }

  hasFailures (walletId?: string): boolean {
    if (walletId != null) return (this.failed.get(walletId)?.size ?? 0) > 0
    return this.failed.size > 0
  }

  lowestFailed (walletId: string): number | null {
    const heights = this.failed.get(walletId)
    if (heights == null || heights.size === 0) return null
    return Math.min(...heights)
  }

  failedHeights (walletId: string): number[] {
    return [...(this.failed.get(walletId) ?? [])].sort((a, b) => a - b)
  }

  // Highest height the cursor may be set to for this request, or null when it
  // must not move at all (the gap starts at or below the current request).
  allowedHeight (walletId: string, requestedHeight: number): number | null {
    const lowest = this.lowestFailed(walletId)
    if (lowest == null) return requestedHeight
    const capped = Math.min(requestedHeight, lowest - 1)
    return capped < 0 ? null : capped
  }

  // True when a block write at this height may carry its own cursor advance
  // (applyBlock bumps the cursor inside the same SQL transaction).
  allowsBlockCursor (walletId: string, height: number): boolean {
    const lowest = this.lowestFailed(walletId)
    return lowest == null || height < lowest
  }
}