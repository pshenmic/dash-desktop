import {ClassicLevel} from 'classic-level'
import {Network} from '../src/types/Network'

import {displayHexToWire} from './byteOrder'
import {ChainTipState, PersistedHeader, StoredState} from './types/chainStore'
import {HEIGHT_KEY_WIDTH} from './constants'

function headerKey(height: number): string {
  return `h:${height.toString().padStart(HEIGHT_KEY_WIDTH, '0')}`
}

function hashKey(height: number): string {
  return `n:${height.toString().padStart(HEIGHT_KEY_WIDTH, '0')}`
}

// Shared across wallets: the filter-header chain is a function of (block,
// network), not of any wallet's watch set.
function filterHeaderKey(height: number): string {
  return `f:${height.toString().padStart(HEIGHT_KEY_WIDTH, '0')}`
}

function stateKey(network: Network): string {
  return `s:${network}`
}

// Single-owner facade over chain storage — workers never open LevelDB directly.
//
// Holds network-scoped data only (headers, hash cache, filter headers); wallet
// state lives in SQL. The split keeps chain storage free of anything that will
// need encrypting under the user's key when SQLCipher lands.
export class ChainStore {
  private db: ClassicLevel<string, Uint8Array>
  private opened = false

  constructor(path: string, readonly network: Network) {
    this.db = new ClassicLevel<string, Uint8Array>(path, {
      keyEncoding: 'utf8',
      valueEncoding: 'view',
      createIfMissing: true,
    })
  }

  open = async (): Promise<void> => {
    if (this.opened) return
    await this.db.open()
    this.opened = true
  }

  close = async (): Promise<void> => {
    if (!this.opened) return
    await this.db.close()
    this.opened = false
  }

  initSyncState = async (): Promise<ChainTipState> => {
    const defaultValue = async (): Promise<{tipHeight: number, tipHash: null}> => {
      const initial: StoredState = {tipHeight: 0, tipHash: null, updatedAt: Date.now()}
      await this.db.put(stateKey(this.network), encodeJson(initial))
      return {tipHeight: 0, tipHash: null}
    }

    try {
      const buf = await this.db.get(stateKey(this.network))
      if (buf == null) return defaultValue()

      const stored = JSON.parse(Buffer.from(buf).toString('utf8')) as StoredState
      if (stored == null) return defaultValue()

      return {tipHeight: stored.tipHeight, tipHash: stored.tipHash}
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== 'LEVEL_NOT_FOUND') throw err
      return defaultValue()
    }
  }

  // Headers and sync_state land together. LevelDB batches arbitrarily large
  // writes, so none of SQLite's 999-parameter chunking is needed.
  appendHeaders = async (headers: PersistedHeader[], nextState: ChainTipState): Promise<void> => {
    if (headers.length === 0) return
    const batch = this.db.batch()
    for (const h of headers) {
      batch.put(headerKey(h.height), h.raw)
      // Free here (processHeaders already computed h.hash) and saves cfilter
      // sync x11-rehashing every header on launch — minutes for a full chain.
      batch.put(hashKey(h.height), displayHexToWire(h.hash))
    }
    const stored: StoredState = {
      tipHeight: nextState.tipHeight,
      tipHash: nextState.tipHash,
      updatedAt: Date.now(),
    }
    batch.put(stateKey(this.network), encodeJson(stored))
    await batch.write()
  }

  // Reorg: drop the orphaned branch and re-point the tip in one batch, so a
  // crash mid-rewind cannot leave a tip marker addressing deleted headers.
  deleteHeadersFrom = async (fromHeight: number, nextState: ChainTipState): Promise<void> => {
    const batch = this.db.batch()
    // ; sorts immediately after :, capping each keyspace at its own prefix.
    for (const [key, cap] of [[headerKey(fromHeight), 'h;'], [hashKey(fromHeight), 'n;']] as const) {
      const iter = this.db.iterator({gte: key, lt: cap})
      try {
        for await (const [k] of iter) batch.del(k)
      } finally {
        await iter.close()
      }
    }
    const stored: StoredState = {
      tipHeight: nextState.tipHeight,
      tipHash: nextState.tipHash,
      updatedAt: Date.now(),
    }
    batch.put(stateKey(this.network), encodeJson(stored))
    await batch.write()
  }

  getHeaderByHeight = async (height: number): Promise<Uint8Array | null> => {
    try {
      return (await this.db.get(headerKey(height))) ?? null
    } catch (err) {
      if ((err as { code?: string }).code === 'LEVEL_NOT_FOUND') return null
      throw err
    }
  }

  // Cached hash chain in [from, to] ascending — the no-x11 fast path. Comes
  // back empty or short for chain.db predating the n: keyspace, in which case
  // the caller falls back to iterateHeadersInRange + x11 and backfills.
  //
  // Streams rather than returning an array: materializing a full chain (2.5M)
  // spikes ~350-700MB of transient objects and V8 keeps that RSS resident.
  forEachHashInRange = async (
    from: number,
    to: number,
    cb: (height: number, wire: Uint8Array) => void,
  ): Promise<number> => {
    if (to < from) return 0
    let n = 0
    const iter = this.db.iterator({gte: hashKey(from), lte: hashKey(to)})
    try {
      for await (const [key, value] of iter) {
        cb(parseInt(key.slice(2), 10), value)
        n++
      }
    } finally {
      await iter.close()
    }
    return n
  }

  // Migrates chain.db that has headers but no hashes. Chunked during the slow
  // x11 path so partial progress survives a restart.
  writeBackfillHashes = async (entries: Array<{ height: number; wire: Uint8Array }>): Promise<void> => {
    if (entries.length === 0) return
    const batch = this.db.batch()
    for (const e of entries) batch.put(hashKey(e.height), e.wire)
    await batch.write()
  }

  // Streaming-only for the same reason as forEachHashInRange.
  forEachFilterHeaderInRange = async (
    from: number,
    to: number,
    cb: (height: number, header: Uint8Array) => void,
  ): Promise<number> => {
    if (to < from) return 0
    let n = 0
    const iter = this.db.iterator({gte: filterHeaderKey(from), lte: filterHeaderKey(to)})
    try {
      for await (const [key, value] of iter) {
        cb(parseInt(key.slice(2), 10), value)
        n++
      }
    } finally {
      await iter.close()
    }
    return n
  }

  writeFilterHeaders = async (entries: Array<{ height: number; header: Uint8Array }>): Promise<void> => {
    if (entries.length === 0) return
    const batch = this.db.batch()
    for (const e of entries) batch.put(filterHeaderKey(e.height), e.header)
    await batch.write()
  }

  // For when cfcheckpt contradicts our cached chain (peer on a different fork,
  // or a stale/poisoned cache) — the walk rebuilds from that height up.
  deleteFilterHeadersFrom = async (fromHeight: number): Promise<void> => {
    const batch = this.db.batch()
    const iter = this.db.iterator({
      gte: filterHeaderKey(fromHeight),
      lt: 'f;', // ; sorts immediately after :, so this caps the range
    })
    try {
      for await (const [key] of iter) batch.del(key)
    } finally {
      await iter.close()
    }
    await batch.write()
  }

  // Lets CFilterSync build its height↔hash maps without recomputing PoW or
  // re-walking from genesis.
  iterateHeadersInRange = async (from: number, to: number): Promise<Array<{ height: number; raw: Uint8Array }>> => {
    if (to < from) return []
    const out: Array<{ height: number; raw: Uint8Array }> = []
    const iter = this.db.iterator({
      gte: headerKey(from),
      lte: headerKey(to),
    })
    try {
      for await (const [key, value] of iter) {
        const height = parseInt(key.slice(2), 10)
        out.push({height, raw: value})
      }
    } finally {
      await iter.close()
    }
    return out
  }
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}
