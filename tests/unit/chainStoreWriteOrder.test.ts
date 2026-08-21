import {describe, it, expect, beforeEach} from 'vitest'
import {ChainStore} from '../../src/main/p2p/store/ChainStore'
import type {PersistedHeader} from '../../src/main/p2p/types/chainStore'

const hashAt = (height: number): string => height.toString(16).padStart(64, '0')

const header = (height: number): PersistedHeader => ({
  height, hash: hashAt(height), prevHash: hashAt(height - 1),
  time: 1_760_000_000, nBits: 0x1e0fffff, raw: new Uint8Array(80),
})

// Stands in for classic-level: a write completes only when the test releases
// it, so overlapping writes are observable rather than a matter of timing.
class ManualLevel {
  maxConcurrentWrites = 0
  failNextWrite = false
  private inFlight = 0
  private pending: Array<() => void> = []

  batch(): {put: () => void; del: () => void; write: () => Promise<void>} {
    const fail = this.failNextWrite
    this.failNextWrite = false
    return {
      put: () => undefined,
      del: () => undefined,
      write: () => new Promise<void>((resolve, reject) => {
        this.inFlight++
        this.maxConcurrentWrites = Math.max(this.maxConcurrentWrites, this.inFlight)
        this.pending.push(() => {
          this.inFlight--
          if (fail) reject(new Error('disk full'))
          else resolve()
        })
      }),
    }
  }

  // deleteHeadersFrom walks the keyspace; an empty range keeps these tests
  // about ordering rather than about what is stored.
  iterator(): AsyncIterable<[string, Uint8Array]> & {close: () => Promise<void>} {
    return {
      [Symbol.asyncIterator]: () => ({next: async () => ({done: true as const, value: undefined})}),
      close: async () => undefined,
    }
  }

  // Releases writes as they appear, one at a time, until the queue drains.
  async drain(): Promise<void> {
    for (let idle = 0; idle < 4;) {
      if (this.pending.length === 0) {
        idle++
      } else {
        idle = 0
        this.pending.shift()!()
      }
      await new Promise(resolve => setImmediate(resolve))
    }
  }
}

describe('ChainStore tip-write ordering', () => {
  let store: ChainStore
  let level: ManualLevel

  beforeEach(() => {
    // ClassicLevel touches no disk until open(), which we never call.
    store = new ChainStore('/nonexistent/chain.db', 'testnet')
    level = new ManualLevel()
    ;(store as unknown as {db: ManualLevel}).db = level
  })

  // HeaderSyncWorker emits 'chainExtended' once its append resolves, and
  // CFilterSyncWorker indexes block hashes from that event. LevelDB resolves
  // concurrent batches in threadpool order, so overlapping appends can announce
  // h+3 before h+1 — and the filter batch built across that hole never
  // completes. One write at a time is what keeps the announcements in order.
  it('never has two tip writes in flight at once', async () => {
    const settled: number[] = []
    const appends = [1, 2, 3].map(async n => {
      await store.appendHeaders([header(n)], {tipHeight: n, tipHash: hashAt(n)})
      settled.push(n)
    })

    await level.drain()
    await Promise.all(appends)

    expect(level.maxConcurrentWrites).toBe(1)
    expect(settled).toEqual([1, 2, 3])
  })

  it('orders a reorg delete against the appends around it', async () => {
    const settled: string[] = []
    const writes = [
      store.appendHeaders([header(1)], {tipHeight: 1, tipHash: hashAt(1)}).then(() => settled.push('append-1')),
      store.deleteHeadersFrom(1, {tipHeight: 0, tipHash: null}).then(() => settled.push('delete')),
      store.appendHeaders([header(2)], {tipHeight: 2, tipHash: hashAt(2)}).then(() => settled.push('append-2')),
    ]

    await level.drain()
    await Promise.all(writes)

    expect(level.maxConcurrentWrites).toBe(1)
    expect(settled).toEqual(['append-1', 'delete', 'append-2'])
  })

  // A rejected write must not leave every later one waiting on it.
  it('keeps writing after one batch fails', async () => {
    level.failNextWrite = true
    // Rejection handlers attached before draining, or the failure surfaces as
    // an unhandled rejection while the queue is still being released.
    const failing = expect(
      store.appendHeaders([header(1)], {tipHeight: 1, tipHash: hashAt(1)}),
    ).rejects.toThrow('disk full')
    const after = expect(
      store.appendHeaders([header(2)], {tipHeight: 2, tipHash: hashAt(2)}),
    ).resolves.toBeUndefined()

    await level.drain()
    await Promise.all([failing, after])
  })
})
