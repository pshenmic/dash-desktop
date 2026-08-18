import {REORG_MAX_DEPTH} from '../constants'
import {hashHeaderRaw, headerWork} from '../utils/pow'
import type {ChainStore} from './ChainStore'
import type {ChainWindowEntry, TrimmedHeaders} from '../types/headerSync'

// The recent-header window: the last REORG_MAX_DEPTH accepted headers, indexed
// both ways. It bounds the getheaders locator and decides how far back an
// incoming branch may connect — a branch that connects nowhere in here is
// refused rather than fetched.
//
// The two maps are one structure: every mutation goes through record() so
// windowByHash cannot outlive the height it points at.
export class ChainWindow {
  private readonly byHeight = new Map<number, ChainWindowEntry>()
  private readonly byHash = new Map<string, number>()

  constructor(private tipHeight: number) {}

  // Called by the worker whenever the tip moves, since the floor is relative
  // to it and stale entries are pruned against it.
  setTip(height: number): void {
    this.tipHeight = height
  }

  async load(chainStore: ChainStore, tipHash: string): Promise<void> {
    const from = Math.max(1, this.tipHeight - REORG_MAX_DEPTH)
    const stored = await chainStore.iterateHeadersInRange(from, this.tipHeight)
    for (const {height, raw} of stored) {
      if (raw.length < 80) continue
      const nBits = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(72, true)
      this.record(height, hashHeaderRaw(raw), headerWork(nBits))
    }
    // Genesis is never written to chain.db, and neither is a resume tip whose
    // headers predate the h: keyspace. Work is only summed above a fork point.
    if (!this.byHeight.has(this.tipHeight)) this.record(this.tipHeight, tipHash, 0n)
  }

  record(height: number, hash: string, work: bigint): void {
    this.byHeight.set(height, {hash, work})
    this.byHash.set(hash, height)
    this.prune()
  }

  prune(): void {
    const floor = Math.max(1, this.tipHeight - REORG_MAX_DEPTH)
    for (const [height, entry] of this.byHeight) {
      if (height >= floor && height <= this.tipHeight) continue
      this.byHeight.delete(height)
      // Only if it still maps here: a rewound height is re-recorded with the
      // winning branch's hash before the loser is pruned.
      if (this.byHash.get(entry.hash) === height) this.byHash.delete(entry.hash)
    }
  }

  hashAt(height: number): string | undefined {
    return this.byHeight.get(height)?.hash
  }

  heightOf(hash: string): number | undefined {
    return this.byHash.get(hash)
  }

  has(hash: string): boolean {
    return this.byHash.has(hash)
  }

  // Total work over (fromHeight, tipHeight] — our side of a fork choice.
  workAbove(fromHeight: number): bigint {
    let total = 0n
    for (let h = fromHeight + 1; h <= this.tipHeight; h++) {
      total += this.byHeight.get(h)?.work ?? 0n
    }
    return total
  }

  // ChainLocks are announced network-wide, so mid-sync the finality height sits
  // millions of blocks above our tip — unclamped it would ask for heights we lack.
  floor(finalityHeight: number): number {
    return Math.max(1, Math.min(finalityHeight, this.tipHeight), this.tipHeight - REORG_MAX_DEPTH)
  }

  // Drops leading headers we already hold, so re-announced blocks of our own do
  // not reach the fork machinery while a batch extending past them still applies.
  trimKnownPrefix(rawHeaders: Uint8Array[], connectsAt: number, connectsTo: string): TrimmedHeaders {
    let height = connectsAt
    let hash = connectsTo
    let index = 0

    while (index < rawHeaders.length) {
      const raw = rawHeaders[index]!
      if (raw.length < 80) break
      const known = this.byHeight.get(height + 1)
      if (known == null || known.hash !== hashHeaderRaw(raw)) break
      height++
      hash = known.hash
      index++
    }

    return {rest: rawHeaders.slice(index), height, hash}
  }
}
