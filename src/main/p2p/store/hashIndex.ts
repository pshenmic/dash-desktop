import {HASH_LEN} from '../constants'

// Height-keyed 32-byte values in one contiguous buffer rather than a
// Map<number,Uint8Array>: at ~2.5M blocks the Map form cost ~600MB in V8 object
// headers and per-array backing stores, this ~80MB. get() returns a copy, so a
// caller may hold it across the reallocation that tip-follow growth triggers.
export class HashIndex {
  private data: Uint8Array
  private present: Uint8Array
  private capacity: number
  private count = 0

  constructor(initialHeights: number) {
    this.capacity = Math.max(initialHeights + 1, 1024)
    this.data = new Uint8Array(this.capacity * HASH_LEN)
    this.present = new Uint8Array((this.capacity + 7) >> 3)
  }

  get size(): number {
    return this.count
  }

  private grow(minHeight: number): void {
    const next = Math.max(minHeight + 1, Math.ceil(this.capacity * 1.5))
    const data = new Uint8Array(next * HASH_LEN)
    data.set(this.data)
    const present = new Uint8Array((next + 7) >> 3)
    present.set(this.present)
    this.data = data
    this.present = present
    this.capacity = next
  }

  has(height: number): boolean {
    return height >= 0 && height < this.capacity && (this.present[height >> 3]! & (1 << (height & 7))) !== 0
  }

  set(height: number, value: Uint8Array): void {
    if (height < 0) return
    if (height >= this.capacity) this.grow(height)
    if (!this.has(height)) this.count++
    this.data.set(value, height * HASH_LEN)
    this.present[height >> 3]! |= 1 << (height & 7)
  }

  get(height: number): Uint8Array | undefined {
    if (!this.has(height)) return undefined
    return this.data.slice(height * HASH_LEN, height * HASH_LEN + HASH_LEN)
  }

  // Checkpoint-divergence recovery: drop everything at or above `fromHeight`.
  deleteFrom(fromHeight: number): void {
    const start = Math.max(0, fromHeight)
    for (let h = start; h < this.capacity; h++) {
      if (this.has(h)) {
        this.present[h >> 3]! &= ~(1 << (h & 7))
        this.count--
      }
    }
  }
}
