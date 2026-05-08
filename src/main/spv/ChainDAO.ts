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

function stateKey(network: Network): string {
  return `s:${network}`
}

function utxoKey(network: Network, txid: string, vout: number): string {
  return `u:${network}:${txid}:${vout}`
}

function utxoPrefix(network: Network): string {
  return `u:${network}:`
}

function cfilterCursorKey(network: Network): string {
  return `cfcursor:${network}`
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

  putUtxo = async (network: Network, utxo: PersistedUtxo): Promise<void> => {
    await this.db.put(utxoKey(network, utxo.txid, utxo.vout), encodeJson(utxo))
  }

  deleteUtxo = async (network: Network, txid: string, vout: number): Promise<void> => {
    try {
      await this.db.del(utxoKey(network, txid, vout))
    } catch (err) {
      if ((err as { code?: string }).code === 'LEVEL_NOT_FOUND') return
      throw err
    }
  }

  // Atomic apply: spends + new outputs land together with the cfilter cursor
  // bump. Without this you can race the writer and emit a UTXO snapshot that
  // mid-batch reflects a spend without its companion receive.
  applyBlockUtxos = async (
    network: Network,
    spends: Array<{ txid: string; vout: number }>,
    received: PersistedUtxo[],
    cursorHeight: number,
  ): Promise<void> => {
    const batch = this.db.batch()
    for (const s of spends) batch.del(utxoKey(network, s.txid, s.vout))
    for (const u of received) batch.put(utxoKey(network, u.txid, u.vout), encodeJson(u))
    batch.put(cfilterCursorKey(network), encodeJson({height: cursorHeight}))
    await batch.write()
  }

  getAllUtxos = async (network: Network): Promise<PersistedUtxo[]> => {
    const prefix = utxoPrefix(network)
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

  getCFilterCursor = async (network: Network): Promise<number | null> => {
    try {
      const buf = await this.db.get(cfilterCursorKey(network))
      if (buf == null) return null
      const parsed = JSON.parse(Buffer.from(buf).toString('utf8')) as { height: number }
      return parsed.height
    } catch (err) {
      if ((err as { code?: string }).code === 'LEVEL_NOT_FOUND') return null
      throw err
    }
  }

  setCFilterCursor = async (network: Network, height: number): Promise<void> => {
    await this.db.put(cfilterCursorKey(network), encodeJson({height}))
  }
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}
