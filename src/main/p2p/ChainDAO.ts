import {ClassicLevel} from 'classic-level'
import {Network} from '../src/types'

export interface PersistedHeader {
  height: number
  hash: string
  prevHash: string
  time: number
  nBits: number
  raw: Uint8Array
}

export interface ChainTipState {
  tipHeight: number
  tipHash: string | null
}

interface StoredState extends ChainTipState {
  updatedAt: number
}

export interface PersistedUtxo {
  txid: string         // display-order hex
  vout: number
  satoshis: string     // bigint serialized as decimal string
  address: string
  height: number
}

const HEIGHT_KEY_WIDTH = 12

function headerKey(height: number): string {
  return `h:${height.toString().padStart(HEIGHT_KEY_WIDTH, '0')}`
}

function hashKey(height: number): string {
  return `n:${height.toString().padStart(HEIGHT_KEY_WIDTH, '0')}`
}

// BIP 158 filter header at height. Network-scoped chain data (chain.db is
// already per-network via path), shared across wallets — the filter-header
// chain is a function of (block, network), not of the wallet's watch set.
function filterHeaderKey(height: number): string {
  return `f:${height.toString().padStart(HEIGHT_KEY_WIDTH, '0')}`
}

function stateKey(network: Network): string {
  return `s:${network}`
}

// Convert a 64-char display-order hex string (what HeaderSync stores) to the
// 32-byte wire representation (what cfilter peers exchange and what we cache
// in heightToBlockHash). Inverse of bytesToHex(wire).
function displayHashToWire(hex: string): Uint8Array {
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    const j = (31 - i) * 2
    out[i] = parseInt(hex.slice(j, j + 2), 16)
  }
  return out
}

// UTXOs and cfilter scan cursor are scoped per-wallet, not per-network: each
// wallet has its own watch set / birthday and produces its own UTXO set,
// even when sharing the same chain.db headers/hashes/filter chain.
function utxoKey(walletId: string, txid: string, vout: number): string {
  return `u:${walletId}:${txid}:${vout}`
}

function utxoPrefix(walletId: string): string {
  return `u:${walletId}:`
}

function cfilterCursorKey(walletId: string): string {
  return `cfcursor:${walletId}`
}

export class ChainDAO {
  private db: ClassicLevel<string, Uint8Array>
  private opened = false

  constructor(path: string) {
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

  initSyncState = async (network: Network): Promise<ChainTipState> => {

    const defaultValue = async ()=> {
      const initial: StoredState = {tipHeight: 0, tipHash: null, updatedAt: Date.now()}
      await this.db.put(stateKey(network), encodeJson(initial))
      return {tipHeight: 0, tipHash: null}
    }

    try {
      const buf = await this.db.get(stateKey(network))

      console.log('stage 1: ', buf)

      if(buf == null) return defaultValue()

      const stored = JSON.parse(Buffer.from(buf).toString('utf8')) as StoredState

      console.log('stage 2: ', stored)

      if (stored == null) return defaultValue()

      console.log('stage 3: returning sync state')

      return {tipHeight: stored.tipHeight, tipHash: stored.tipHash}
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== 'LEVEL_NOT_FOUND') throw err
      return defaultValue()
    }
  }

  // Atomic write: all headers + sync_state update land together. LevelDB's
  // batch API handles arbitrarily large batches without the 999-parameter
  // limit that forced per-50 chunking under SQLite.
  appendHeaders = async (
    network: Network,
    headers: PersistedHeader[],
    nextState: ChainTipState,
  ): Promise<void> => {
    if (headers.length === 0) return
    const batch = this.db.batch()
    for (const h of headers) {
      batch.put(headerKey(h.height), h.raw)
      // Persist the wire-byte hash too. Without this, cfilter sync has to
      // x11-rehash every header on every launch (minutes for a full chain).
      // We already computed h.hash in processHeaders, so this is free CPU.
      batch.put(hashKey(h.height), displayHashToWire(h.hash))
    }
    const stored: StoredState = {
      tipHeight: nextState.tipHeight,
      tipHash: nextState.tipHash,
      updatedAt: Date.now(),
    }
    batch.put(stateKey(network), encodeJson(stored))
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

  // Iterates persisted wire-byte hashes in [from, to] inclusive, ascending.
  // Returns the cached hash chain (no x11) — fast path for buildChainIndex.
  // For chain.db state predating the n: keyspace, the result will be empty
  // or short and the caller should fall back to iterateHeadersInRange + x11
  // (and backfill via writeBackfillHashes).
  iterateHashesInRange = async (from: number, to: number): Promise<Array<{ height: number; wire: Uint8Array }>> => {
    if (to < from) return []
    const out: Array<{ height: number; wire: Uint8Array }> = []
    const iter = this.db.iterator({
      gte: hashKey(from),
      lte: hashKey(to),
    })
    try {
      for await (const [key, value] of iter) {
        const height = parseInt(key.slice(2), 10)
        out.push({height, wire: value})
      }
    } finally {
      await iter.close()
    }
    return out
  }

  // Backfill helper for migrating chain.db that has headers but no hashes.
  // Called in chunks during the slow x11 path so partial progress survives
  // a restart.
  writeBackfillHashes = async (entries: Array<{ height: number; wire: Uint8Array }>): Promise<void> => {
    if (entries.length === 0) return
    const batch = this.db.batch()
    for (const e of entries) batch.put(hashKey(e.height), e.wire)
    await batch.write()
  }

  // Filter headers (32-byte BIP 158 values). Network-scoped, reused across
  // wallets — every wallet on the same chain derives the same filter-header
  // chain regardless of watch set.
  iterateFilterHeadersInRange = async (from: number, to: number): Promise<Array<{ height: number; header: Uint8Array }>> => {
    if (to < from) return []
    const out: Array<{ height: number; header: Uint8Array }> = []
    const iter = this.db.iterator({
      gte: filterHeaderKey(from),
      lte: filterHeaderKey(to),
    })
    try {
      for await (const [key, value] of iter) {
        const height = parseInt(key.slice(2), 10)
        out.push({height, header: value})
      }
    } finally {
      await iter.close()
    }
    return out
  }

  writeFilterHeaders = async (entries: Array<{ height: number; header: Uint8Array }>): Promise<void> => {
    if (entries.length === 0) return
    const batch = this.db.batch()
    for (const e of entries) batch.put(filterHeaderKey(e.height), e.header)
    await batch.write()
  }

  // Drop cached filter headers from a height onward. Used when cfcheckpt
  // contradicts our cached chain (peer sees a different fork, or our cache is
  // poisoned/stale) — we rebuild from that height up via the walk.
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

  // Iterates raw 80-byte headers in [from, to] inclusive, ascending. Used by
  // CFilterSync to build its in-memory height↔hash maps without recomputing
  // PoW or re-walking from genesis.
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

  putUtxo = async (walletId: string, utxo: PersistedUtxo): Promise<void> => {
    await this.db.put(utxoKey(walletId, utxo.txid, utxo.vout), encodeJson(utxo))
  }

  deleteUtxo = async (walletId: string, txid: string, vout: number): Promise<void> => {
    try {
      await this.db.del(utxoKey(walletId, txid, vout))
    } catch (err) {
      if ((err as { code?: string }).code === 'LEVEL_NOT_FOUND') return
      throw err
    }
  }

  // Atomic apply: spends + new outputs land together with the cfilter cursor
  // bump. Without this you can race the writer and emit a UTXO snapshot that
  // mid-batch reflects a spend without its companion receive.
  applyBlockUtxos = async (
    walletId: string,
    spends: Array<{ txid: string; vout: number }>,
    received: PersistedUtxo[],
    cursorHeight: number,
  ): Promise<void> => {
    const batch = this.db.batch()
    for (const s of spends) batch.del(utxoKey(walletId, s.txid, s.vout))
    for (const u of received) batch.put(utxoKey(walletId, u.txid, u.vout), encodeJson(u))
    batch.put(cfilterCursorKey(walletId), encodeJson({height: cursorHeight}))
    await batch.write()
  }

  getAllUtxos = async (walletId: string): Promise<PersistedUtxo[]> => {
    const prefix = utxoPrefix(walletId)
    const out: PersistedUtxo[] = []
    const iter = this.db.iterator({
      gte: prefix,
      lte: prefix + '\xff',
    })
    try {
      for await (const [, value] of iter) {
        out.push(JSON.parse(Buffer.from(value).toString('utf8')) as PersistedUtxo)
      }
    } finally {
      await iter.close()
    }
    return out
  }

  getCFilterCursor = async (walletId: string): Promise<number | null> => {
    try {
      const buf = await this.db.get(cfilterCursorKey(walletId))
      if (buf == null) return null
      const parsed = JSON.parse(Buffer.from(buf).toString('utf8')) as { height: number }
      return parsed.height
    } catch (err) {
      if ((err as { code?: string }).code === 'LEVEL_NOT_FOUND') return null
      throw err
    }
  }

  setCFilterCursor = async (walletId: string, height: number): Promise<void> => {
    await this.db.put(cfilterCursorKey(walletId), encodeJson({height}))
  }
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}
