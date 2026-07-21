// Compact-filter (BIP 157/158) UTXO scan worker. Phases:
//   1. cfcheckpt   anchor filter-header chain at every 1000-block boundary
//   2. cfheaders   walk birthday→tip, derive filter headers locally, verify
//                  against checkpoints; persist to chain.db (network-shared)
//   3. cfilters    pull GCS payloads, match watched scripts/outpoints, fetch
//                  matched blocks, emit blockApplied events with full tx data
//
// Persists to chain.db:
//   - f:<height>           filter headers (network-scoped, reusable)
//   - n:<height>           wire-byte block hashes (network-scoped)
//
// Wallet-scoped state (UTXOs, cfilter cursor, transactions) lives in SQL
// in the main process. The worker emits 'blockApplied' / 'cursorAdvanced'
// events and main writes them through TransactionDAO. The worker keeps an
// in-memory UTXO map for spend detection in subsequent blocks; it's seeded
// from main at start time via the start command.

import {
  type CFCheckptArgs,
  type CFHeadersArgs,
  type CFilterArgs,
  CompactFilter,
  Inventory,
  type Message,
  type Peer,
} from 'dash-core-p2p'
import {Block, OutPoint, Script, utils as sdkUtils} from 'dash-core-sdk'
// @ts-ignore — no bundled types for @dashevo/x11-hash-js
import x11 from '@dashevo/x11-hash-js'
import {Network} from '../../src/types'
import {ChainStore, PersistedHeader} from '../ChainStore'
import {PoolService} from '../PoolService'
import {GENESIS} from '../constants'
import type {
  AppliedBlock,
  AppliedSpend,
  AppliedTx,
  AppliedTxInput,
  AppliedTxOutput,
  WalletSyncUtxo,
} from '../types/walletSync'
import type {
  CFilterPhase,
  CFilterSyncWorkerOptions,
  CFilterSyncWorkerStatus,
} from '../types/cfilterSync'

export type {CFilterPhase, CFilterSyncWorkerOptions, CFilterSyncWorkerStatus}
import {
  BLOCK_REQUEST_TIMEOUT_MS,
  CFCHECKPT_RACE_PEERS,
  CFCHECKPT_RACE_TIMEOUT_MS,
  CFHEADERS_RACE_PEERS,
  CFHEADERS_RACE_TIMEOUT_MS,
  CFILTER_BATCH,
  CFILTER_BATCH_TIMEOUT_MS,
  FILTER_TYPE,
  MAX_INFLIGHT_BATCHES,
  SCAN_TIP_DEPTH,
} from '../constants'
import {Worker} from './Worker'

const {doubleSHA256, hexToBytes, bytesToHex, addressToPublicKeyHash} = sdkUtils

interface CFilterBatch {
  startHeight: number
  stopHeight: number
  stopHashWire: Uint8Array
  remaining: Set<number>
  timer: ReturnType<typeof setTimeout> | null
}

interface BlockRequest {
  hashWire: Uint8Array
  height: number
  triedPeers: Set<Peer>
  timer: ReturnType<typeof setTimeout> | null
}

interface PendingCFHeaders {
  startHeight: number
  stopHeight: number
  triedPeers: Set<Peer>
  raceTimer: ReturnType<typeof setTimeout> | null
}

function displayHexToWire(hex: string): Uint8Array {
  return hexToBytes(hex).reverse()
}

function wireToDisplayHex(wire: Uint8Array): string {
  let out = ''
  for (let i = wire.length - 1; i >= 0; i--) out += wire[i]!.toString(16).padStart(2, '0')
  return out
}

function x11Wire(raw: Uint8Array): Uint8Array {
  const buf = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Uint8Array((x11 as any).digest(buf, 1, 1) as number[])
}

function p2pkhScript(address: string): Uint8Array {
  const s = new Script()
  s.pushOpCode('OP_DUP')
  s.pushOpCode('OP_HASH160')
  s.pushOpCode('OP_PUSHBYTES_20', addressToPublicKeyHash(address))
  s.pushOpCode('OP_EQUALVERIFY')
  s.pushOpCode('OP_CHECKSIG')
  return s.bytes()
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

const HASH_LEN = 32

// Point-in-time resident-memory probe. RSS is what Activity Monitor / Task
// Manager show for the dash-p2p process; `external`+`arrayBuffers` cover the
// off-heap typed-array backing stores that `ps rss` under-counts.
function logMem(label: string): void {
  const MB = 1024 * 1024
  const m = process.memoryUsage()
  console.log(
    `[p2p-mem] ${label}: rss=${(m.rss / MB).toFixed(0)}MB heapUsed=${(m.heapUsed / MB).toFixed(0)}MB ` +
    `external=${(m.external / MB).toFixed(0)}MB arrayBuffers=${(m.arrayBuffers / MB).toFixed(0)}MB`,
  )
}

// Dense height→wire-hash index backed by one contiguous buffer instead of a
// Map holding a separate Uint8Array per block. At ~2.5M blocks a
// Map<number,Uint8Array> costs ~600MB (≈245B/entry: V8 object header +
// per-array backing store); this stores 32B/block (~80MB) plus a 1-bit/height
// presence bitmap. get() returns a copy so callers may retain it across the
// buffer reallocation that tip-follow growth triggers.
class BlockHashIndex {
  private data: Uint8Array
  private present: Uint8Array
  private capacity: number

  constructor(initialHeights: number) {
    this.capacity = Math.max(initialHeights + 1, 1024)
    this.data = new Uint8Array(this.capacity * HASH_LEN)
    this.present = new Uint8Array((this.capacity + 7) >> 3)
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

  set(height: number, wire: Uint8Array): void {
    if (height < 0) return
    if (height >= this.capacity) this.grow(height)
    this.data.set(wire, height * HASH_LEN)
    this.present[height >> 3]! |= 1 << (height & 7)
  }

  has(height: number): boolean {
    return height >= 0 && height < this.capacity && (this.present[height >> 3]! & (1 << (height & 7))) !== 0
  }

  get(height: number): Uint8Array | undefined {
    if (!this.has(height)) return undefined
    return this.data.slice(height * HASH_LEN, height * HASH_LEN + HASH_LEN)
  }
}

// Height → 32-byte filter header, backed by one flat buffer + a presence
// bitset — same layout as BlockHashIndex. Replaces a Map<number, Uint8Array>
// whose per-entry V8 overhead (~150-250B/entry) made the whole-chain filter-
// header cache the p2p process' dominant resident cost (~400MB → ~70MB).
class FilterHeaderIndex {
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

  set(height: number, header: Uint8Array): void {
    if (height < 0) return
    if (height >= this.capacity) this.grow(height)
    if (!this.has(height)) this.count++
    this.data.set(header, height * HASH_LEN)
    this.present[height >> 3]! |= 1 << (height & 7)
  }

  get(height: number): Uint8Array | undefined {
    if (!this.has(height)) return undefined
    return this.data.slice(height * HASH_LEN, height * HASH_LEN + HASH_LEN)
  }

  // Drop every stored header at or above `fromHeight` (checkpoint-divergence
  // recovery). Replaces iterating Map keys to delete a tail.
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

export class CFilterSyncWorker extends Worker {
  readonly name = 'CFilterSyncWorker'

  // ── deps + immutable seed ────────────────────────────────────────────────
  private readonly network: Network
  private readonly walletId: string
  private readonly chainStore: ChainStore
  private readonly peerPool: PoolService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly M: any
  private readonly seedUtxos: WalletSyncUtxo[]
  private readonly initialCfilterCursor: number | null
  private readonly birthdayHeight: number

  // ── chain state (mutable: extended on tip-follow) ────────────────────────
  private chainTipHeight: number
  private chainTipWire: Uint8Array

  // ── worker state ─────────────────────────────────────────────────────────
  private phase: CFilterPhase = 'connecting'
  private stopped = false
  private leader: Peer | null = null

  // ── chain index (height → wire-byte hash) ────────────────────────────────
  // Forward index only. The reverse (hash→height) lookup is served from
  // bounded inflight state instead of a whole-chain Map: block fetches carry
  // their height (blockFetch.inflight), cfilter batches register their hashes
  // in cfilterInflightHeights, and cfheaders match against the few pending
  // stop-hashes. This drops a ~250MB full-chain hex-string map.
  private readonly blockHashIndex: BlockHashIndex
  private cfilterInflightHeights = new Map<string, number>()

  // ── filter-header chain ──────────────────────────────────────────────────
  private readonly heightToFilterHeader: FilterHeaderIndex
  private checkpointHeaders = new Map<number, Uint8Array>()
  private anchorHeight = -1

  // ── watch set (cfilter inputs) ──────────────────────────────────────────
  private watchedItems: Uint8Array[] = []
  private watchedAddressSet = new Set<string>()

  // ── per-phase state ─────────────────────────────────────────────────────
  private cfcheckpt = {
    responded: false,
    raceTimer: null as ReturnType<typeof setTimeout> | null,
    triedPeers: new Set<Peer>(),
  }

  private cfHeaders = {
    walkStart: 0,
    pending: new Map<number, PendingCFHeaders>(),
  }

  private cfilter = {
    cursor: 0,
    inflightBatches: new Map<number, CFilterBatch>(),
  }

  private blockFetch = {
    inflight: new Map<string, BlockRequest>(),
    matched: new Map<number, Block>(),
  }

  // In-memory UTXO map. Source of truth lives in SQL (main process); this
  // is a session cache seeded at start time and mutated as blocks apply.
  // Discarded on stop and re-derived from SQL on next start.
  //
  // Why the worker holds this at all (we can't be fully stateless):
  //
  //   1. BIP 158 outpoint watching — STRUCTURAL, can't move.
  //      The cfilter match (cf.matchAny(this.watchedItems)) runs in this
  //      worker because that's where peer messages arrive. The match set
  //      must include both our scriptPubKeys AND our outpoints, otherwise
  //      we'd miss any tx that spends one of our UTXOs without paying any
  //      of our addresses (i.e. pure outgoing txs). Adding a received
  //      output's outpoint to watchedItems requires knowing it's ours;
  //      removing a spent outpoint requires knowing which one matched.
  //
  private utxos = new Map<string, WalletSyncUtxo>()

  // Bound peer-event listeners. Stable references kept for stop()'s off().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly peerListeners: Array<[string, (...args: any[]) => void]> = [
    ['peerready', (p: Peer) => this.handlePeerReady(p)],
    ['peerdisconnect', (p: Peer) => this.handlePeerDisconnect(p)],
    ['peercfcheckpt', (p: Peer, m: Message) => this.onCheckpoints(m as Message & CFCheckptArgs, p)],
    ['peercfheaders', (p: Peer, m: Message) => this.onCFHeaders(m as Message & CFHeadersArgs, p)],
    ['peercfilter', (_p: Peer, m: Message) => this.onCFilter(m as Message & CFilterArgs)],
    ['peerblock', (p: Peer, m: Message & {block?: unknown}) => this.handlePeerBlock(p, m)],
  ]

  constructor(opts: CFilterSyncWorkerOptions) {
    super()
    this.network = opts.network
    this.walletId = opts.walletId
    this.chainStore = opts.chainStore
    this.peerPool = opts.peerPool
    this.chainTipHeight = opts.chainTipHeight
    this.chainTipWire = displayHexToWire(opts.chainTipHashDisplayHex)
    this.blockHashIndex = new BlockHashIndex(opts.chainTipHeight)
    this.heightToFilterHeader = new FilterHeaderIndex(opts.chainTipHeight)
    this.birthdayHeight = Math.max(1, opts.birthdayHeight)
    this.seedUtxos = opts.seedUtxos
    this.initialCfilterCursor = opts.cfilterCursor

    for (const a of opts.watchAddresses) {
      this.watchedAddressSet.add(a)
      this.watchedItems.push(p2pkhScript(a))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.M = this.peerPool.messages as any
  }

  start = async (): Promise<void> => {
    // Restore prior per-wallet state from seed (sourced from SQL by main).
    for (const u of this.seedUtxos) {
      this.utxos.set(`${u.txid}:${u.vout}`, u)
      this.watchedItems.push(new OutPoint(u.txid, u.vout).bytes())
    }

    this.cfilter.cursor = this.initialCfilterCursor != null
      ? Math.max(this.birthdayHeight, this.initialCfilterCursor + 1)
      : this.birthdayHeight

    await this.buildChainIndex()
    logMem('after buildChainIndex')

    // Seed genesis (height 1) into the index — HeaderSync starts WITH this
    // header as its tip and only persists subsequent ones, so it's not in
    // chain.db.
    this.setHashIndex(1, displayHexToWire(GENESIS[this.network].hash))

    // Network-shared filter-header cache. Streamed straight into the flat
    // index — never materialized as a whole-chain array (see forEachHashInRange).
    const loadedFilterHeaders = await this.chainStore.forEachFilterHeaderInRange(
      1, this.chainTipHeight,
      (height, header) => this.heightToFilterHeader.set(height, header),
    )
    if (loadedFilterHeaders > 0) {
      console.log(`[cfilter] loaded ${loadedFilterHeaders} filter headers from cache`)
    }
    logMem(`after filter-header load (index size=${this.heightToFilterHeader.size})`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [evt, handler] of this.peerListeners) (this.peerPool as any).on(evt, handler)
    this.emitStatus('connecting')

    // Already-ready filter-capable peers? Kick off cfcheckpt now.
    if (this.peerPool.filterCapablePeers.size > 0) this.requestCheckpoints()
  }

  stop = (): void => {
    if (this.stopped) return
    this.stopped = true
    this.clearTimers()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [evt, handler] of this.peerListeners) (this.peerPool as any).off(evt, handler)
    this.emitStatus('stopped')
  }

  // Called by the Orchestrator when HeaderSyncWorker emits 'chainExtended'.
  onChainExtended = (headers: PersistedHeader[]): void => {
    if (this.stopped || headers.length === 0) return
    for (const h of headers) this.setHashIndex(h.height, displayHexToWire(h.hash))
    const last = headers[headers.length - 1]!
    if (last.height > this.chainTipHeight) {
      this.chainTipHeight = last.height
      this.chainTipWire = displayHexToWire(last.hash)
    }
    if (this.phase !== 'synced' && this.phase !== 'cfilters') return
    if (this.cfilter.cursor <= this.effectiveScanTipHeight()) {
      if (this.phase === 'synced') this.emitStatus('cfilters')
      this.pumpCFilters()
    }
  }

  // Hot-add of newly created wallet addresses. Cursor is rewound to the
  // caller-supplied height (defaults to birthday) so historical filters
  // are re-matched against the new addresses.
  addWatchAddresses = (addresses: string[], rewindToHeight?: number): void => {
    if (this.stopped) return
    let added = 0
    for (const a of addresses) {
      if (this.watchedAddressSet.has(a)) continue
      this.watchedAddressSet.add(a)
      this.watchedItems.push(p2pkhScript(a))
      added++
    }
    if (added === 0) return
    const target = Math.max(this.birthdayHeight, rewindToHeight ?? this.birthdayHeight)
    console.log(`[cfilter] addWatchAddresses +${added} (total ${this.watchedAddressSet.size}); rewinding cursor to h=${target}`)

    for (const b of this.cfilter.inflightBatches.values()) if (b.timer) clearTimeout(b.timer)
    this.cfilter.inflightBatches.clear()
    this.cfilterInflightHeights.clear()
    this.blockFetch.matched.clear()
    this.cfilter.cursor = target

    if (this.phase === 'cfheaders' || this.phase === 'cfcheckpt' || this.phase === 'connecting') return
    if (this.heightToFilterHeader.size === 0) {
      this.requestCheckpoints()
      return
    }
    this.emitStatus('cfilters')
    this.pumpCFilters()
  }

  // ── status & utilities ────────────────────────────────────────────────────

  private emitStatus(phase: CFilterPhase): void {
    this.phase = phase
    this.emit('status', {
      phase,
      cfheadersHeight: Math.max(0, this.cfHeaders.walkStart - 1),
      cfilterScanHeight: Math.max(0, this.cfilter.cursor - 1),
      matchedBlocksPending: this.blockFetch.matched.size + this.blockFetch.inflight.size,
      peerCount: this.peerPool.readyPeers.size,
      filterCapablePeerCount: this.peerPool.filterCapablePeers.size,
    } satisfies CFilterSyncWorkerStatus)
  }

  private setHashIndex(height: number, wire: Uint8Array): void {
    this.blockHashIndex.set(height, wire)
  }

  private clearTimers(): void {
    if (this.cfcheckpt.raceTimer) clearTimeout(this.cfcheckpt.raceTimer)
    this.cfcheckpt.raceTimer = null
    for (const p of this.cfHeaders.pending.values()) if (p.raceTimer) clearTimeout(p.raceTimer)
    for (const b of this.cfilter.inflightBatches.values()) if (b.timer) clearTimeout(b.timer)
    for (const r of this.blockFetch.inflight.values()) if (r.timer) clearTimeout(r.timer)
    this.cfHeaders.pending.clear()
    this.cfilter.inflightBatches.clear()
    this.cfilterInflightHeights.clear()
    this.blockFetch.inflight.clear()
  }

  private effectiveScanTipHeight(): number {
    return Math.max(this.birthdayHeight, this.chainTipHeight - SCAN_TIP_DEPTH)
  }

  // ── chain index ───────────────────────────────────────────────────────────

  private async buildChainIndex(): Promise<void> {
    // Always cover the full chain (1..chainTip). Optimizing to a narrow
    // resume window breaks cfcheckpt's stop-hash lookup and addWatchAddresses
    // re-scan from birthday. The n: cache makes this a fast range scan.
    const from = 1
    const to = this.chainTipHeight
    const expected = to - from + 1
    console.log(`[cfilter] building chain index ${from}..${to}`)

    // Stream the cached hashes straight into the flat index — the array form
    // spikes hundreds of MB of transient objects that V8 keeps resident.
    const cachedCount = await this.chainStore.forEachHashInRange(
      from, to, (height, wire) => this.setHashIndex(height, wire),
    )
    if (cachedCount === expected) {
      console.log(`[cfilter] chain index loaded from cache (${cachedCount} entries)`)
    } else {
      // Fallback: x11 + backfill for the heights the cache is missing (already-
      // cached heights are in blockHashIndex from the stream above). One-time
      // cost on chain.db that predates the n: keyspace.
      console.log(`[cfilter] no hash cache (${cachedCount}/${expected}); hashing + backfilling`)
      const headers = await this.chainStore.iterateHeadersInRange(from, to)
      let processed = 0
      let backfill: Array<{height: number; wire: Uint8Array}> = []
      for (const {height, raw} of headers) {
        if (!this.blockHashIndex.has(height)) {
          const wire = x11Wire(raw)
          this.setHashIndex(height, wire)
          backfill.push({height, wire})
        }
        processed++
        if (processed % 50_000 === 0) {
          console.log(`[cfilter] chain index ${processed}/${headers.length}`)
          if (backfill.length > 0) {
            await this.chainStore.writeBackfillHashes(backfill)
            backfill = []
          }
          await new Promise(resolve => setImmediate(resolve))
        }
      }
      if (backfill.length > 0) await this.chainStore.writeBackfillHashes(backfill)
      console.log(`[cfilter] chain index built (${processed} entries, hashes cached)`)
    }

    // Tip not in chain.db (HeaderSync starts WITH it, persists only after).
    if (!this.blockHashIndex.has(this.chainTipHeight)) {
      this.setHashIndex(this.chainTipHeight, this.chainTipWire)
    }
  }

  // ── peer event handlers ───────────────────────────────────────────────────

  private handlePeerReady(peer: Peer): void {
    if (this.stopped) return
    const cf = this.peerPool.filterCapablePeers.has(peer) ? '+CF' : '-CF'
    console.log(`[cfilter] peerready ${peer.host}:${peer.port} ${cf} ready=${this.peerPool.readyPeers.size}`)
    if (this.phase === 'connecting' && this.peerPool.filterCapablePeers.size > 0) {
      this.requestCheckpoints()
    }
  }

  private handlePeerDisconnect(peer: Peer): void {
    if (peer === this.leader) {
      this.leader = null
      if (this.phase === 'cfcheckpt') this.requestCheckpoints()
    }
  }

  private handlePeerBlock(peer: Peer, message: Message & {block?: unknown}): void {
    if (this.stopped) return
    const block = message.block as Block | undefined
    if (!block) {
      console.warn(`[cfilter] peerblock from ${peer.host} missing block payload`)
      return
    }
    const blockHashHex = block.hash()
    const blockHashWire = displayHexToWire(blockHashHex)
    const key = bytesToHex(blockHashWire)
    // Blocks only arrive because we requested them, so the inflight request
    // carries the height — no whole-chain hash→height map needed here.
    const pending = this.blockFetch.inflight.get(key)
    const height = pending ? pending.height : -1
    if (pending) {
      if (pending.timer) clearTimeout(pending.timer)
      this.blockFetch.inflight.delete(key)
    }
    if (height < 0) {
      console.warn(`[cfilter] peerblock from ${peer.host} unknown hash ${blockHashHex.slice(0, 16)}…`)
      return
    }
    console.log(`[cfilter] peerblock h=${height} from ${peer.host}  inflight-blocks=${this.blockFetch.inflight.size}`)
    if (this.phase === 'cfilters') {
      this.blockFetch.matched.set(height, block)
      this.maybeDrainAndFinish().catch(err => {
        console.error('[cfilter] drain failed:', err)
        this.reportError(formatChainDbError(err), false)
      })
    } else {
      this.applyBlock(block, height).catch(err => {
        console.error('[cfilter] applyBlock failed:', err)
        this.reportError(formatChainDbError(err), false)
      })
    }
  }

  // ── cfcheckpt ──────────────────────────────────────────────────────────────

  private requestCheckpoints(): void {
    if (this.stopped) return
    this.cfcheckpt.responded = false
    // Highest checkpoint (real height that is a multiple of 1000) at or below
    // the scan tip, expressed in our internal numbering.
    const stopHeight = Math.floor(this.effectiveScanTipHeight() / 1000) * 1000
    const stopHashWire = this.blockHashIndex.get(stopHeight)
    if (!stopHashWire) {
      console.warn(`[cfilter] cfcheckpt: no hash for stop h=${stopHeight}, chain too short`)
      return
    }
    let candidates = [...this.peerPool.filterCapablePeers].filter(p => !this.cfcheckpt.triedPeers.has(p))
    if (candidates.length === 0) {
      this.cfcheckpt.triedPeers.clear()
      candidates = [...this.peerPool.filterCapablePeers]
    }
    if (candidates.length === 0) {
      console.warn('[cfilter] cfcheckpt: no +CF peers — waiting')
      return
    }
    const picks = candidates.slice(0, CFCHECKPT_RACE_PEERS)
    console.log(`[cfilter] cfcheckpt stopHeight=${stopHeight} picks=${picks.length} pool=${this.peerPool.filterCapablePeers.size}`)
    const msg = this.M.GetCFCheckpt({filterType: FILTER_TYPE, stopHash: stopHashWire})
    for (const p of picks) {
      this.cfcheckpt.triedPeers.add(p)
      p.sendMessage(msg)
    }
    if (this.cfcheckpt.raceTimer) clearTimeout(this.cfcheckpt.raceTimer)
    this.cfcheckpt.raceTimer = setTimeout(() => {
      if (this.cfcheckpt.responded || this.stopped) return
      console.warn('[cfilter] cfcheckpt timeout — rotating')
      this.requestCheckpoints()
    }, CFCHECKPT_RACE_TIMEOUT_MS)
    this.emitStatus('cfcheckpt')
  }

  private onCheckpoints(msg: CFCheckptArgs, fromPeer: Peer): void {
    if (this.stopped || this.cfcheckpt.responded) return
    this.cfcheckpt.responded = true
    this.cfcheckpt.triedPeers.clear()
    if (this.cfcheckpt.raceTimer) {
      clearTimeout(this.cfcheckpt.raceTimer)
      this.cfcheckpt.raceTimer = null
    }
    this.leader = fromPeer

    const headers = msg.filterHeaders ?? []
    // headers[i] is the filter header at real height (i+1)*1000; key it by the
    // matching internal height.
    for (let i = 0; i < headers.length; i++) {
      this.checkpointHeaders.set((i + 1) * 1000, headers[i]!)
    }

    // Cross-validate cached filter headers against checkpoints.
    let firstBadCheckpoint = Infinity
    for (const [ckptHeight, ckptHeader] of this.checkpointHeaders) {
      const cached = this.heightToFilterHeader.get(ckptHeight)
      if (cached && !equalBytes(cached, ckptHeader)) {
        firstBadCheckpoint = Math.min(firstBadCheckpoint, ckptHeight)
      }
    }
    if (firstBadCheckpoint !== Infinity) {
      console.warn(`[cfilter] cached filter headers diverge from checkpoint at h=${firstBadCheckpoint} — dropping cache from there`)
      this.heightToFilterHeader.deleteFrom(firstBadCheckpoint)
      this.chainStore.deleteFilterHeadersFrom(firstBadCheckpoint).catch(err => {
        console.error('[cfilter] failed to drop stale filter headers:', err)
        this.reportError(formatChainDbError(err), false)
      })
    }

    const start = Math.max(this.birthdayHeight, this.cfilter.cursor)
    const anchorCkpt = Math.floor((start - 1) / 1000) * 1000
    if (anchorCkpt > 0 && this.checkpointHeaders.has(anchorCkpt)) {
      this.anchorHeight = anchorCkpt
      this.heightToFilterHeader.set(anchorCkpt, this.checkpointHeaders.get(anchorCkpt)!)
    } else {
      this.anchorHeight = 0
    }
    console.log(`[cfilter] received ${headers.length} checkpoints; anchor at h=${this.anchorHeight}; cached headers=${this.heightToFilterHeader.size}`)
    this.cfHeaders.walkStart = Math.max(this.anchorHeight + 1, this.birthdayHeight)
    this.walkCFHeadersNext()
  }

  // ── cfheaders walk ────────────────────────────────────────────────────────

  private walkCFHeadersNext(): void {
    if (this.stopped) return
    const effectiveTip = this.effectiveScanTipHeight()

    while (this.cfHeaders.walkStart <= effectiveTip) {
      const startHeight = this.cfHeaders.walkStart
      const nextCkpt = (Math.floor(startHeight / 1000) + 1) * 1000
      const stopHeight = Math.min(nextCkpt, effectiveTip)
      let fullyCached = true
      for (let h = startHeight; h <= stopHeight; h++) {
        if (!this.heightToFilterHeader.has(h)) { fullyCached = false; break }
      }
      if (!fullyCached) break
      this.cfHeaders.walkStart = stopHeight + 1
    }

    if (this.cfHeaders.walkStart > effectiveTip) {
      console.log('[cfilter] cfheaders complete (cached); starting cfilter scan')
      this.startCFilterScan()
      return
    }
    this.emitStatus('cfheaders')
    const startHeight = this.cfHeaders.walkStart
    const nextCkpt = (Math.floor(startHeight / 1000) + 1) * 1000
    const stopHeight = Math.min(nextCkpt, effectiveTip)
    if (!this.blockHashIndex.has(stopHeight)) {
      console.warn(`[cfilter] cfheaders: no hash for h=${stopHeight}; stopping`)
      return
    }
    if (this.cfHeaders.pending.has(stopHeight)) return
    if (this.peerPool.filterCapablePeers.size === 0) {
      console.warn('[cfilter] cfheaders: no +CF peers — waiting')
      return
    }
    const entry: PendingCFHeaders = {startHeight, stopHeight, triedPeers: new Set(), raceTimer: null}
    this.cfHeaders.pending.set(stopHeight, entry)
    this.dispatchCFHeaders(entry)
    this.armCFHeadersTimer(entry)
  }

  private dispatchCFHeaders(entry: PendingCFHeaders): void {
    const stopHashWire = this.blockHashIndex.get(entry.stopHeight)
    if (!stopHashWire) return
    let candidates = [...this.peerPool.filterCapablePeers].filter(p => !entry.triedPeers.has(p))
    if (candidates.length === 0) {
      entry.triedPeers.clear()
      candidates = [...this.peerPool.filterCapablePeers]
    }
    const picks = candidates.slice(0, CFHEADERS_RACE_PEERS)
    const msg = this.M.GetCFHeaders({filterType: FILTER_TYPE, startHeight: entry.startHeight, stopHash: stopHashWire})
    for (const p of picks) {
      entry.triedPeers.add(p)
      p.sendMessage(msg)
    }
  }

  private armCFHeadersTimer(entry: PendingCFHeaders): void {
    if (entry.raceTimer) clearTimeout(entry.raceTimer)
    entry.raceTimer = setTimeout(() => {
      if (!this.cfHeaders.pending.has(entry.stopHeight) || this.stopped) return
      console.warn(`[cfilter] cfheaders ${entry.startHeight}..${entry.stopHeight} timeout — re-racing`)
      this.dispatchCFHeaders(entry)
      this.armCFHeadersTimer(entry)
    }, CFHEADERS_RACE_TIMEOUT_MS)
  }

  private onCFHeaders(msg: CFHeadersArgs, fromPeer: Peer): void {
    if (this.stopped) return
    const stopHashWire = msg.stopHash ?? new Uint8Array(32)
    // Match by stop-hash against the few pending cfheaders requests rather than
    // a whole-chain hash→height map; pending is keyed by stopHeight and tiny.
    let pending: PendingCFHeaders | undefined
    for (const entry of this.cfHeaders.pending.values()) {
      const wire = this.blockHashIndex.get(entry.stopHeight)
      if (wire && equalBytes(wire, stopHashWire)) { pending = entry; break }
    }
    if (!pending) return

    const filterHashes = msg.filterHashes ?? []
    const expectedCount = pending.stopHeight - pending.startHeight + 1
    if (filterHashes.length !== expectedCount) {
      console.warn(`[cfilter] cfheaders count mismatch ${pending.startHeight}..${pending.stopHeight}: got ${filterHashes.length} expected ${expectedCount} from ${fromPeer.host} — re-racing`)
      this.dispatchCFHeaders(pending)
      this.armCFHeadersTimer(pending)
      return
    }

    let prev = msg.previousFilterHeader ?? new Uint8Array(32)
    const prevExpected = this.heightToFilterHeader.get(pending.startHeight - 1)
    if (prevExpected && !equalBytes(prevExpected, prev)) {
      console.warn(`[cfilter] cfheaders prev mismatch at h=${pending.startHeight - 1} from ${fromPeer.host} — re-racing`)
      this.dispatchCFHeaders(pending)
      this.armCFHeadersTimer(pending)
      return
    }
    const derived: Array<{height: number; header: Uint8Array}> = []
    for (let i = 0; i < filterHashes.length; i++) {
      const concat = new Uint8Array(64)
      concat.set(filterHashes[i]!, 0)
      concat.set(prev, 32)
      const next = doubleSHA256(concat)
      derived.push({height: pending.startHeight + i, header: next})
      prev = next
    }
    const ckpt = this.checkpointHeaders.get(pending.stopHeight)
    if (ckpt && !equalBytes(ckpt, prev)) {
      console.warn(`[cfilter] cfheaders checkpoint mismatch at h=${pending.stopHeight} from ${fromPeer.host} — peer dishonest, re-racing`)
      this.dispatchCFHeaders(pending)
      this.armCFHeadersTimer(pending)
      return
    }

    if (pending.raceTimer) clearTimeout(pending.raceTimer)
    this.cfHeaders.pending.delete(pending.stopHeight)
    this.leader = fromPeer

    for (const e of derived) this.heightToFilterHeader.set(e.height, e.header)
    this.chainStore.writeFilterHeaders(derived).catch(err => {
      console.error('[cfilter] failed to persist filter headers:', err)
      this.reportError(formatChainDbError(err), false)
    })

    console.log(`[cfheaders] processed checkpoint until: ${pending.startHeight}`)

    this.cfHeaders.walkStart = pending.stopHeight + 1
    this.emitStatus('cfheaders')
    this.walkCFHeadersNext()
  }

  // ── cfilter scan ──────────────────────────────────────────────────────────

  private startCFilterScan(): void {
    this.cfilter.cursor = Math.max(this.birthdayHeight, this.cfilter.cursor, this.anchorHeight + 1)
    console.log(`[cfilter] scanning ${this.cfilter.cursor}..${this.effectiveScanTipHeight()}`)
    this.emitStatus('cfilters')
    this.pumpCFilters()
  }

  private dispatchCFilterBatch(batch: CFilterBatch): void {
    const racers = [...this.peerPool.filterCapablePeers]
    if (racers.length === 0) return
    const msg = this.M.GetCFilters({
      filterType: FILTER_TYPE,
      startHeight: batch.startHeight,
      stopHash: batch.stopHashWire,
    })
    for (const p of racers) p.sendMessage(msg)
  }

  private armCFilterBatchTimer(batch: CFilterBatch): void {
    if (batch.timer) clearTimeout(batch.timer)
    batch.timer = setTimeout(() => {
      if (!this.cfilter.inflightBatches.has(batch.startHeight) || this.stopped) return
      if (batch.remaining.size === 0) return
      console.warn(`[cfilter] batch ${batch.startHeight}..${batch.stopHeight} stuck (${batch.remaining.size}) — re-racing`)
      this.dispatchCFilterBatch(batch)
      this.armCFilterBatchTimer(batch)
    }, CFILTER_BATCH_TIMEOUT_MS)
  }

  private pumpCFilters(): void {
    if (this.stopped) return
    const effectiveTip = this.effectiveScanTipHeight()
    while (this.cfilter.cursor <= effectiveTip && this.cfilter.inflightBatches.size < MAX_INFLIGHT_BATCHES) {
      const startHeight = this.cfilter.cursor
      const stopHeight = Math.min(startHeight + CFILTER_BATCH - 1, effectiveTip)
      const stopHashWire = this.blockHashIndex.get(stopHeight)
      if (!stopHashWire) break
      const remaining = new Set<number>()
      for (let h = startHeight; h <= stopHeight; h++) {
        remaining.add(h)
        const wire = this.blockHashIndex.get(h)
        if (wire) this.cfilterInflightHeights.set(bytesToHex(wire), h)
      }
      const batch: CFilterBatch = {startHeight, stopHeight, stopHashWire, remaining, timer: null}
      this.cfilter.inflightBatches.set(startHeight, batch)
      this.dispatchCFilterBatch(batch)
      this.armCFilterBatchTimer(batch)
      this.cfilter.cursor = stopHeight + 1
    }
    if (this.cfilter.cursor > effectiveTip && this.cfilter.inflightBatches.size === 0) {
      this.maybeDrainAndFinish().catch(err => {
        console.error('[cfilter] drain failed:', err)
        this.reportError(formatChainDbError(err), false)
      })
    }
  }

  private async maybeDrainAndFinish(): Promise<void> {
    if (this.phase !== 'cfilters') return
    if (this.cfilter.cursor <= this.effectiveScanTipHeight()) return
    if (this.cfilter.inflightBatches.size > 0) return
    if (this.blockFetch.inflight.size > 0) {
      const waiting = [...this.blockFetch.inflight.values()].map(r => r.height).sort((a, b) => a - b)
      console.log(`[cfilters] scan reached tip; waiting on ${waiting.length} block(s): ${waiting.slice(0, 10).join(',')}${waiting.length > 10 ? '…' : ''}`)
      return
    }
    const sortedHeights = [...this.blockFetch.matched.keys()].sort((a, b) => a - b)
    for (const h of sortedHeights) {
      await this.applyBlock(this.blockFetch.matched.get(h)!, h)
    }
    this.blockFetch.matched.clear()
    // Advance the persisted cursor to the effective scan tip — covers the
    // run of unmatched blocks that produced no blockApplied events.
    this.emit('cursorAdvanced', {walletId: this.walletId, height: this.effectiveScanTipHeight()})
    this.emitStatus('synced')
    const balance = [...this.utxos.values()].reduce((s, u) => s + BigInt(u.satoshis), 0n)
    console.log(`[cfilter] scan complete utxos=${this.utxos.size} balance=${balance.toString()} sats`)
  }

  private onCFilter(msg: CFilterArgs): void {
    if (this.stopped) return
    const blockHashWire = msg.blockHash ?? new Uint8Array(32)
    const hashKey = bytesToHex(blockHashWire)
    const height = this.cfilterInflightHeights.get(hashKey) ?? -1
    if (height < 0) return
    let owner: CFilterBatch | undefined
    for (const b of this.cfilter.inflightBatches.values()) {
      if (b.remaining.has(height)) { owner = b; break }
    }
    if (!owner) return
    owner.remaining.delete(height)
    this.cfilterInflightHeights.delete(hashKey)

    const cf = new CompactFilter(msg.filter ?? new Uint8Array(0), blockHashWire)
    if (cf.matchAny(this.watchedItems)) {
      console.log(`[cfilter] match h=${height} block=${wireToDisplayHex(blockHashWire).slice(0, 16)}…`)
      this.requestFullBlock(height, blockHashWire)
    }

    if (owner.remaining.size === 0) {
      if (owner.timer) clearTimeout(owner.timer)
      this.cfilter.inflightBatches.delete(owner.startHeight)
      if (height % 5000 < CFILTER_BATCH) {
        console.log(`[cfilters] batch ${owner.startHeight}..${owner.stopHeight} done  inflight-batches=${this.cfilter.inflightBatches.size}`)
      }
      if (this.phase === 'cfilters') {
        this.emitStatus('cfilters')
        this.pumpCFilters()
      }
    }
  }

  private requestFullBlock(height: number, blockHashWire: Uint8Array): void {
    const key = bytesToHex(blockHashWire)
    if (this.blockFetch.inflight.has(key)) return
    const entry: BlockRequest = {hashWire: blockHashWire, height, triedPeers: new Set(), timer: null}
    this.blockFetch.inflight.set(key, entry)
    const target = this.pickBlockPeer(new Set())
    if (target) {
      entry.triedPeers.add(target)
      target.sendMessage(this.M.GetData([{type: Inventory.TYPE.BLOCK, hash: blockHashWire}]))
    } else {
      console.warn(`[cfilter] block h=${height} matched but no ready peers — retrying on timer`)
    }
    this.armBlockRequestTimer(key, entry)
  }

  private pickBlockPeer(exclude: Set<Peer>): Peer | undefined {
    for (const p of this.peerPool.readyPeers) if (!exclude.has(p)) return p
    return undefined
  }

  private armBlockRequestTimer(key: string, entry: BlockRequest): void {
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      if (this.stopped || !this.blockFetch.inflight.has(key)) return
      let next = this.pickBlockPeer(entry.triedPeers)
      if (!next) {
        entry.triedPeers.clear()
        next = this.pickBlockPeer(entry.triedPeers)
        if (!next) {
          console.warn(`[cfilter] block h=${entry.height} retry — no ready peers, re-arming`)
          this.armBlockRequestTimer(key, entry)
          return
        }
        console.warn(`[cfilter] block h=${entry.height} retry — no fresh peers, re-asking ${next.host}`)
      } else {
        console.warn(`[cfilter] block h=${entry.height} timeout — retrying via ${next.host} (tried ${entry.triedPeers.size})`)
      }
      entry.triedPeers.add(next)
      next.sendMessage(this.M.GetData([{type: Inventory.TYPE.BLOCK, hash: entry.hashWire}]))
      this.armBlockRequestTimer(key, entry)
    }, BLOCK_REQUEST_TIMEOUT_MS)
  }

  private async applyBlock(block: Block, height: number): Promise<void> {
    if (this.stopped) return
    const blockHashHex = block.hash()
    const blockTime = block.blockHeader.time
    const oursTxs: AppliedTx[] = []
    const spends: AppliedSpend[] = []

    for (const tx of block.txs) {
      const txid = tx.hash()
      const inputs: AppliedTxInput[] = []
      const outputs: AppliedTxOutput[] = []
      let isOurs = false

      for (let vin = 0; vin < tx.inputs.length; vin++) {
        const input = tx.inputs[vin]!
        inputs.push({vin, prevTxid: input.txId, prevVout: input.vOut, sequence: input.sequence})
        const u = this.utxos.get(`${input.txId}:${input.vOut}`)
        if (u) {
          spends.push({prevTxid: u.txid, prevVout: u.vout, spentInTxid: txid})
          this.utxos.delete(`${input.txId}:${input.vOut}`)
          isOurs = true
          console.log(`[cfilter] spent ${u.txid.slice(0, 16)}…:${u.vout} -${u.satoshis} h=${height}`)
        }
      }

      for (let vout = 0; vout < tx.outputs.length; vout++) {
        const output = tx.outputs[vout]!
        const address = output.getAddress(this.network === 'mainnet' ? 'Mainnet' : 'Testnet')
        const isMine = !!(address && this.watchedAddressSet.has(address))
        outputs.push({vout, address: address ?? null, satoshis: output.satoshis.toString(), isMine})
        if (!isMine) continue
        const k = `${txid}:${vout}`
        if (this.utxos.has(k)) continue
        const u: WalletSyncUtxo = {txid, vout, satoshis: output.satoshis.toString(), address: address!, height}
        this.utxos.set(k, u)
        this.watchedItems.push(new OutPoint(txid, vout).bytes())
        isOurs = true
        console.log(`[cfilter] received ${txid.slice(0, 16)}…:${vout} +${u.satoshis} h=${height} (${address})`)
      }

      if (isOurs) oursTxs.push({txid, raw: tx.bytes(), inputs, outputs})
    }

    if (oursTxs.length === 0 && spends.length === 0) return
    this.emit('blockApplied', {
      walletId: this.walletId,
      height,
      blockHash: blockHashHex,
      blockTime,
      txs: oursTxs,
      spends,
    } satisfies AppliedBlock)
  }
}

// Include the LevelDB error code (LEVEL_IO_ERROR, LEVEL_CORRUPTION, …) in
// the message so SyncService.isFatalChainDbError picks it up and tears down.
function formatChainDbError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const code = (err as { code?: string }).code
  return code ? `${code}: ${message}` : message
}
