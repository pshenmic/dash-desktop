// Compact-filter (BIP 157/158) UTXO scan, ported from the dash-core-p2p
// `wallet_sync_cfilters` example into our utility process. Phases:
//   1. cfcheckpt   anchor filter-header chain at every 1000-block boundary
//   2. cfheaders   walk birthday→tip, derive each filter header locally, verify
//                  vs. checkpoints
//   3. cfilters    pull GCS payloads, match watched scripts/outpoints, fetch
//                  matched blocks, apply tx effects to the UTXO set
// Persisted in chain.db: `u:<network>:<txid>:<vout>` UTXOs and a
// `cfcursor:<network>` resume marker. Filter headers are re-derived per run.
//
// Caveats inherited from the example: requires +CF peers, no reorg handling,
// trusts header chain as already-authenticated by HeaderSync.

import {
  CompactFilter,
  Inventory,
  Messages,
  NODE_COMPACT_FILTERS,
  Pool,
  type CFCheckptArgs,
  type CFHeadersArgs,
  type CFilterArgs,
  type Message,
  type Peer,
} from 'dash-core-p2p'
import {Block, utils as sdkUtils} from 'dash-core-sdk'
// @ts-ignore — no bundled types for @dashevo/x11-hash-js
import x11 from '@dashevo/x11-hash-js'
import {Network} from '../src/types'
import {ChainDAO, PersistedHeader, PersistedUtxo} from './ChainDAO'
import {GENESIS_HASH} from './genesis'

const {doubleSHA256, hexToBytes, bytesToHex, addressToPublicKeyHash} = sdkUtils

const FILTER_TYPE = 0
const CFILTER_BATCH = 800
const CFCHECKPT_RACE_PEERS = 12
const CFCHECKPT_RACE_TIMEOUT_MS = 15_000
const CFHEADERS_RACE_TIMEOUT_MS = 15_000
const CFILTER_BATCH_TIMEOUT_MS = 15_000
const BLOCK_REQUEST_TIMEOUT_MS = 15_000
const MAX_INFLIGHT_BATCHES = 4
// Dash Core silently drops getcf* whose stop_hash isn't in its active chain
// (reorgs / peer lag), so cap stop hashes a fixed depth below the synced tip.
const SCAN_TIP_DEPTH = 100

export type CFilterPhase =
  | 'connecting'
  | 'cfcheckpt'
  | 'cfheaders'
  | 'cfilters'
  | 'synced'
  | 'stopped'

export interface CFilterSyncStatus {
  phase: CFilterPhase
  cfilterHeight: number
  utxoCount: number
  peerCount: number
}

export interface CFilterSyncOptions {
  network: Network
  chainDAO: ChainDAO
  chainTipHeight: number
  chainTipHashDisplayHex: string
  watchAddresses: string[]
  birthdayHeight: number
  emitStatus: (status: CFilterSyncStatus) => void
  emitUtxos: (utxos: PersistedUtxo[]) => void
}

interface CFilterBatch {
  startHeight: number
  stopHeight: number
  stopHashWire: Uint8Array
  remaining: Set<number>
  timer: ReturnType<typeof setTimeout> | null
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
  return new Uint8Array((x11 as any).digest(buf, 1, 1) as number[])
}

function p2pkhScript(address: string): Uint8Array {
  const hash160 = addressToPublicKeyHash(address)
  const out = new Uint8Array(25)
  out[0] = 0x76
  out[1] = 0xa9
  out[2] = 0x14
  out.set(hash160, 3)
  out[23] = 0x88
  out[24] = 0xac
  return out
}

function bip158Outpoint(txidDisplay: string, vout: number): Uint8Array {
  const out = new Uint8Array(36)
  out.set(displayHexToWire(txidDisplay), 0)
  new DataView(out.buffer).setUint32(32, vout, true)
  return out
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export class CFilterSync {
  private network: Network
  private chainDAO: ChainDAO
  private emitStatusCb: (status: CFilterSyncStatus) => void
  private emitUtxosCb: (utxos: PersistedUtxo[]) => void

  private chainTipHeight: number
  private chainTipWire: Uint8Array
  private birthdayHeight: number

  private pool: Pool
  private messages: Messages
  private M: any

  private phase: CFilterPhase = 'connecting'
  private stopped = false

  private peerServices = new WeakMap<Peer, bigint>()
  private filterCapablePeers = new Set<Peer>()
  private readyPeers = new Set<Peer>()
  private leader: Peer | null = null

  // Wire-byte chain index built lazily from ChainDAO at start.
  private heightToBlockHash = new Map<number, Uint8Array>()
  private wireHexToHeight = new Map<string, number>()
  private heightToFilterHeader = new Map<number, Uint8Array>()
  private checkpointHeaders = new Map<number, Uint8Array>()
  private anchorHeight = -1

  private watchedItems: Uint8Array[] = []
  private watchedAddressSet = new Set<string>()

  // cfcheckpt race state
  private cfcheckptResponded = false
  private cfcheckptRaceTimer: ReturnType<typeof setTimeout> | null = null
  private cfcheckptTriedPeers = new Set<Peer>()

  // cfheaders walk state
  private cfHeadersWalkStart = 0
  private pendingCFHeaders = new Map<number, {
    startHeight: number
    stopHeight: number
    raceTimer: ReturnType<typeof setTimeout> | null
  }>()

  // cfilter scan state
  private cfilterCursor = 0
  private inflightBatches = new Map<number, CFilterBatch>()
  // Each in-flight block request remembers the wire-bytes hash, the height
  // (for logging), the peer we asked, and a retry timer. If the peer doesn't
  // deliver within BLOCK_REQUEST_TIMEOUT_MS we re-ask a different one — a
  // single unresponsive leader otherwise freezes maybeDrainAndFinish.
  private blockRequestsInflight = new Map<string, {
    hashWire: Uint8Array
    height: number
    triedPeers: Set<Peer>
    timer: ReturnType<typeof setTimeout> | null
  }>()
  private matchedBlocks = new Map<number, Block>()

  // UTXO state — keyed `${txid}:${vout}`. Mirrors persisted state in chain.db.
  private utxos = new Map<string, PersistedUtxo>()
  private seenOwnOutpoints = new Set<string>()

  constructor(opts: CFilterSyncOptions) {
    this.network = opts.network
    this.chainDAO = opts.chainDAO
    this.emitStatusCb = opts.emitStatus
    this.emitUtxosCb = opts.emitUtxos
    this.chainTipHeight = opts.chainTipHeight
    this.chainTipWire = displayHexToWire(opts.chainTipHashDisplayHex)
    this.birthdayHeight = Math.max(1, opts.birthdayHeight)

    for (const a of opts.watchAddresses) {
      this.watchedAddressSet.add(a)
      this.watchedItems.push(p2pkhScript(a))
    }

    this.messages = new Messages({network: this.network} as any)
    this.M = this.messages
    this.pool = new Pool({
      network: this.network,
      maxSize: 256,
      relay: false,
      messages: this.messages,
      dnsSeed: true,
    } as any)

    this.bindHandlers()
  }

  start = async (): Promise<void> => {
    // Restore prior progress: if we've scanned past the birthday in a previous
    // run, resume from the cursor. Already-persisted UTXOs are loaded so the
    // first emission to the renderer reflects on-disk state immediately.
    const cursor = await this.chainDAO.getCFilterCursor(this.network)
    const persistedUtxos = await this.chainDAO.getAllUtxos(this.network)
    for (const u of persistedUtxos) {
      const k = `${u.txid}:${u.vout}`
      this.utxos.set(k, u)
      this.seenOwnOutpoints.add(k)
      this.watchedItems.push(bip158Outpoint(u.txid, u.vout))
    }
    if (persistedUtxos.length > 0) this.emitUtxosCb(persistedUtxos)

    const resumeHeight = cursor != null ? Math.max(this.birthdayHeight, cursor + 1) : this.birthdayHeight
    this.cfilterCursor = resumeHeight

    await this.buildChainIndex(resumeHeight)

    // Seed the initial chain anchor (genesis at height 1) into the index.
    // HeaderSync starts WITH this header as its tip and only persists headers
    // received afterward, so it's not in chain.db. Without this, cfilter
    // responses for block 1 can't be mapped to a height and the batch
    // covering height 1 stays stuck forever (mirrors the example's seed at
    // INITIAL_TIP_HEIGHT/HASH).
    const genesisWire = displayHexToWire(GENESIS_HASH[this.network])
    this.heightToBlockHash.set(1, genesisWire)
    this.wireHexToHeight.set(bytesToHex(genesisWire), 1)

    this.emit('connecting')
    this.pool.connect()
  }

  stop = (): void => {
    if (this.stopped) return
    this.stopped = true
    this.clearTimers()
    try { this.pool.disconnect() } catch { /* ignore */ }
    this.phase = 'stopped'
    this.emit('stopped')
  }

  // Called by HeaderSync after each persisted tip extension. We update the
  // in-memory chain index and, if the initial scan is finished, pump cfilters
  // for any heights that just buried past SCAN_TIP_DEPTH.
  onChainExtended = (headers: PersistedHeader[]): void => {
    if (this.stopped || headers.length === 0) return
    for (const h of headers) {
      const wire = displayHexToWire(h.hash)
      this.heightToBlockHash.set(h.height, wire)
      this.wireHexToHeight.set(bytesToHex(wire), h.height)
    }
    const last = headers[headers.length - 1]!
    if (last.height > this.chainTipHeight) {
      this.chainTipHeight = last.height
      this.chainTipWire = displayHexToWire(last.hash)
    }
    // Initial sync isn't done — earlier phases will pick up the new tip when
    // they progress naturally.
    if (this.phase !== 'synced' && this.phase !== 'cfilters') return
    if (this.cfilterCursor <= this.effectiveScanTipHeight()) {
      // Re-enter the scanning phase so status reflects the live work.
      if (this.phase === 'synced') this.emit('cfilters')
      this.phase = 'cfilters'
      this.pumpCFilters()
    }
  }

  // Hot-add of newly created wallet addresses. Existing UTXOs stay; we rewind
  // the cfilter cursor to birthday so the new addresses get matched against
  // historical filters. cfheaders are reused from cache when available.
  addWatchAddresses = (addresses: string[]): void => {
    if (this.stopped) return
    let added = 0
    for (const a of addresses) {
      if (this.watchedAddressSet.has(a)) continue
      this.watchedAddressSet.add(a)
      this.watchedItems.push(p2pkhScript(a))
      added++
    }
    if (added === 0) return
    console.log(`[cfilter] addWatchAddresses +${added} (total ${this.watchedAddressSet.size}); re-scanning from birthday`)

    // Cancel in-flight cfilter batches — they're scanning with the old watch
    // set, and re-issuing covers the same range with the new one anyway.
    for (const b of this.inflightBatches.values()) {
      if (b.timer) clearTimeout(b.timer)
    }
    this.inflightBatches.clear()
    this.matchedBlocks.clear()
    this.cfilterCursor = this.birthdayHeight

    if (this.phase === 'cfheaders' || this.phase === 'cfcheckpt' || this.phase === 'connecting') {
      // The walking phases will hit cfilters naturally; nothing to do.
      return
    }
    if (this.heightToFilterHeader.size === 0) {
      // We never finished cfheaders; restart from checkpoints.
      this.requestCheckpoints()
      return
    }
    this.phase = 'cfilters'
    this.emit('cfilters')
    this.pumpCFilters()
  }

  private clearTimers(): void {
    if (this.cfcheckptRaceTimer) clearTimeout(this.cfcheckptRaceTimer)
    this.cfcheckptRaceTimer = null
    for (const p of this.pendingCFHeaders.values()) {
      if (p.raceTimer) clearTimeout(p.raceTimer)
    }
    this.pendingCFHeaders.clear()
    for (const b of this.inflightBatches.values()) {
      if (b.timer) clearTimeout(b.timer)
    }
    this.inflightBatches.clear()
    for (const r of this.blockRequestsInflight.values()) {
      if (r.timer) clearTimeout(r.timer)
    }
    this.blockRequestsInflight.clear()
  }

  private emit(phase: CFilterPhase): void {
    this.phase = phase
    // During cfcheckpt/cfheaders we report walk progress; during cfilters we
    // report scan cursor; otherwise the cursor is meaningful as-is.
    const cfilterHeight =
      phase === 'cfheaders' || phase === 'cfcheckpt'
        ? Math.max(0, this.cfHeadersWalkStart - 1)
        : Math.max(0, this.cfilterCursor - 1)
    this.emitStatusCb({
      phase,
      cfilterHeight,
      utxoCount: this.utxos.size,
      peerCount: this.readyPeers.size,
    })
  }

  // Build the height ↔ wire-hash maps from persisted headers. We need both
  // directions: cfilter responses identify blocks by hash, cfheader requests
  // identify them by stop-height.
  private async buildChainIndex(resumeHeight: number): Promise<void> {
    const from = Math.max(1, resumeHeight - 1)
    const to = this.chainTipHeight
    console.log(`[cfilter] building chain index ${from}..${to}`)
    const headers = await this.chainDAO.iterateHeadersInRange(from, to)
    console.log(`[cfilter] hashing ${headers.length} headers`)
    let processed = 0
    for (const {height, raw} of headers) {
      const wire = x11Wire(raw)
      this.heightToBlockHash.set(height, wire)
      this.wireHexToHeight.set(bytesToHex(wire), height)
      processed++
      // Yield the event loop periodically so console.log flushes and incoming
      // peer messages get a chance to be parsed. Without this the entire
      // utility process stalls for 1-3 minutes on a fresh-from-genesis chain.
      if (processed % 50_000 === 0) {
        console.log(`[cfilter] chain index ${processed}/${headers.length}`)
        await new Promise(resolve => setImmediate(resolve))
      }
    }
    console.log(`[cfilter] chain index built (${processed} entries)`)
    if (!this.heightToBlockHash.has(this.chainTipHeight)) {
      this.heightToBlockHash.set(this.chainTipHeight, this.chainTipWire)
      this.wireHexToHeight.set(bytesToHex(this.chainTipWire), this.chainTipHeight)
    }
  }

  private peerServesFilters(peer: Peer): boolean {
    return this.filterCapablePeers.has(peer)
  }

  private effectiveScanTipHeight(): number {
    return Math.max(this.birthdayHeight, this.chainTipHeight - SCAN_TIP_DEPTH)
  }

  private cfcheckptStopHeight(): number {
    return Math.floor(this.effectiveScanTipHeight() / 1000) * 1000
  }

  private bindHandlers(): void {
    this.pool.on('peerversion', (peer: Peer, message: Message & { services?: bigint }) => {
      const services = message.services ?? 0n
      this.peerServices.set(peer, services)
      if ((services & BigInt(NODE_COMPACT_FILTERS)) !== 0n) {
        this.filterCapablePeers.add(peer)
      }
    })

    this.pool.on('peerready', (peer: Peer) => {
      if (this.stopped) return
      this.readyPeers.add(peer)
      const cf = this.peerServesFilters(peer) ? '+CF' : '-CF'
      console.log(`[cfilter] peerready ${peer.host}:${peer.port} ${cf} ready=${this.readyPeers.size}`)
      if (this.phase === 'connecting' && this.filterCapablePeers.size > 0) {
        this.requestCheckpoints()
      }
    })

    this.pool.on('peerdisconnect', (peer: Peer) => {
      this.readyPeers.delete(peer)
      this.filterCapablePeers.delete(peer)
      if (peer === this.leader) {
        this.leader = null
        if (this.phase === 'cfcheckpt') this.requestCheckpoints()
      }
    })

    this.pool.on('peercfcheckpt', (peer: Peer, message: Message & CFCheckptArgs) => {
      if (this.stopped) return
      this.onCheckpoints(message, peer)
    })

    this.pool.on('peercfheaders', (peer: Peer, message: Message & CFHeadersArgs) => {
      if (this.stopped) return
      this.onCFHeaders(message, peer)
    })

    this.pool.on('peercfilter', (_peer: Peer, message: Message & CFilterArgs) => {
      if (this.stopped) return
      this.onCFilter(message)
    })

    this.pool.on('peerblock', (peer: Peer, message: Message & { block?: Block }) => {
      if (this.stopped) return
      const block = message.block
      if (!block) {
        console.warn(`[cfilter] peerblock from ${peer.host} missing block payload`)
        return
      }
      const blockHashHex = block.hash()
      const blockHashWire = displayHexToWire(blockHashHex)
      const key = bytesToHex(blockHashWire)
      const height = this.wireHexToHeight.get(key) ?? -1
      const pending = this.blockRequestsInflight.get(key)
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer)
        this.blockRequestsInflight.delete(key)
      }
      if (height < 0) {
        console.warn(`[cfilter] peerblock from ${peer.host} unknown hash ${blockHashHex.slice(0, 16)}…`)
        return
      }
      console.log(`[cfilter] peerblock h=${height} from ${peer.host}  inflight-blocks=${this.blockRequestsInflight.size}`)
      if (this.phase === 'cfilters') {
        this.matchedBlocks.set(height, block)
        this.maybeDrainAndFinish().catch(err => console.error('[cfilter] drain failed:', err))
      } else {
        this.applyBlock(block, height).catch(err => console.error('[cfilter] applyBlock failed:', err))
      }
    })

    this.pool.on('seederror', (err: Error) => {
      console.error('[cfilter] seed error:', err.message)
    })
  }

  // ── cfcheckpt ──────────────────────────────────────────────────────────────

  private requestCheckpoints(): void {
    if (this.stopped) return
    this.phase = 'cfcheckpt'
    this.cfcheckptResponded = false
    const stopHeight = this.cfcheckptStopHeight()
    const stopHashWire = this.heightToBlockHash.get(stopHeight)
    if (!stopHashWire) {
      console.warn(`[cfilter] cfcheckpt: no hash for stop h=${stopHeight}, chain too short`)
      return
    }
    let candidates = [...this.filterCapablePeers].filter(p => !this.cfcheckptTriedPeers.has(p))
    if (candidates.length === 0) {
      this.cfcheckptTriedPeers.clear()
      candidates = [...this.filterCapablePeers]
    }
    if (candidates.length === 0) {
      console.warn('[cfilter] cfcheckpt: no +CF peers — waiting')
      return
    }
    const picks = candidates.slice(0, CFCHECKPT_RACE_PEERS)
    console.log(`[cfilter] cfcheckpt stopHeight=${stopHeight} picks=${picks.length} pool=${this.filterCapablePeers.size}`)
    const msg = this.M.GetCFCheckpt({filterType: FILTER_TYPE, stopHash: stopHashWire})
    for (const p of picks) {
      this.cfcheckptTriedPeers.add(p)
      p.sendMessage(msg)
    }
    if (this.cfcheckptRaceTimer) clearTimeout(this.cfcheckptRaceTimer)
    this.cfcheckptRaceTimer = setTimeout(() => {
      if (this.cfcheckptResponded || this.stopped) return
      console.warn('[cfilter] cfcheckpt timeout — rotating')
      this.requestCheckpoints()
    }, CFCHECKPT_RACE_TIMEOUT_MS)
    this.emit('cfcheckpt')
  }

  private onCheckpoints(msg: CFCheckptArgs, fromPeer: Peer): void {
    if (this.cfcheckptResponded) return
    this.cfcheckptResponded = true
    this.cfcheckptTriedPeers.clear()
    if (this.cfcheckptRaceTimer) {
      clearTimeout(this.cfcheckptRaceTimer)
      this.cfcheckptRaceTimer = null
    }
    this.leader = fromPeer

    const headers = msg.filterHeaders ?? []
    for (let i = 0; i < headers.length; i++) {
      this.checkpointHeaders.set((i + 1) * 1000, headers[i]!)
    }
    const start = Math.max(this.birthdayHeight, this.cfilterCursor)
    const anchorCkpt = Math.floor((start - 1) / 1000) * 1000
    let anchorFilterHeader: Uint8Array
    if (anchorCkpt > 0 && this.checkpointHeaders.has(anchorCkpt)) {
      this.anchorHeight = anchorCkpt
      anchorFilterHeader = this.checkpointHeaders.get(anchorCkpt)!
      this.heightToFilterHeader.set(anchorCkpt, anchorFilterHeader)
    } else {
      this.anchorHeight = 0
      anchorFilterHeader = new Uint8Array(32)
    }
    console.log(`[cfilter] received ${headers.length} checkpoints; anchor at h=${this.anchorHeight}`)
    this.cfHeadersWalkStart = Math.max(this.anchorHeight + 1, this.birthdayHeight)
    this.walkCFHeadersNext()
  }

  // ── cfheaders walk ────────────────────────────────────────────────────────

  private walkCFHeadersNext(): void {
    if (this.stopped) return
    const effectiveTip = this.effectiveScanTipHeight()
    if (this.cfHeadersWalkStart > effectiveTip) {
      console.log('[cfilter] cfheaders complete; starting cfilter scan')
      this.startCFilterScan()
      return
    }
    this.phase = 'cfheaders'
    const startHeight = this.cfHeadersWalkStart
    const nextCkpt = (Math.floor((startHeight - 1) / 1000) + 1) * 1000
    const stopHeight = Math.min(nextCkpt, effectiveTip)
    const stopHashWire = this.heightToBlockHash.get(stopHeight)
    if (!stopHashWire) {
      console.warn(`[cfilter] cfheaders: no hash for h=${stopHeight}; stopping`)
      return
    }
    if (this.pendingCFHeaders.has(stopHeight)) return

    const racers = [...this.filterCapablePeers]
    if (racers.length === 0) {
      console.warn('[cfilter] cfheaders: no +CF peers — waiting')
      return
    }
    const entry = {startHeight, stopHeight, raceTimer: null as ReturnType<typeof setTimeout> | null}
    this.pendingCFHeaders.set(stopHeight, entry)
    const msg = this.M.GetCFHeaders({filterType: FILTER_TYPE, startHeight, stopHash: stopHashWire})
    for (const p of racers) p.sendMessage(msg)
    entry.raceTimer = setTimeout(() => {
      if (!this.pendingCFHeaders.has(stopHeight) || this.stopped) return
      console.warn(`[cfilter] cfheaders ${startHeight}..${stopHeight} timeout — re-racing`)
      this.pendingCFHeaders.delete(stopHeight)
      this.walkCFHeadersNext()
    }, CFHEADERS_RACE_TIMEOUT_MS)
  }

  private onCFHeaders(msg: CFHeadersArgs, fromPeer: Peer): void {
    const stopHashWire = msg.stopHash ?? new Uint8Array(32)
    const stopHeight = this.wireHexToHeight.get(bytesToHex(stopHashWire)) ?? -1
    const pending = stopHeight >= 0 ? this.pendingCFHeaders.get(stopHeight) : undefined
    if (!pending) return
    if (pending.raceTimer) clearTimeout(pending.raceTimer)
    this.pendingCFHeaders.delete(stopHeight)
    this.leader = fromPeer

    const filterHashes = msg.filterHashes ?? []
    const expectedCount = pending.stopHeight - pending.startHeight + 1
    if (filterHashes.length !== expectedCount) {
      console.warn(`[cfilter] cfheaders count mismatch: got ${filterHashes.length} expected ${expectedCount}`)
      return
    }

    let prev = msg.previousFilterHeader ?? new Uint8Array(32)
    const prevExpected = this.heightToFilterHeader.get(pending.startHeight - 1)
    if (prevExpected && !equalBytes(prevExpected, prev)) {
      console.warn(`[cfilter] cfheaders prev mismatch at h=${pending.startHeight - 1}`)
      return
    }
    for (let i = 0; i < filterHashes.length; i++) {
      const concat = new Uint8Array(64)
      concat.set(filterHashes[i]!, 0)
      concat.set(prev, 32)
      const next = doubleSHA256(concat)
      this.heightToFilterHeader.set(pending.startHeight + i, next)
      prev = next
    }
    const ckpt = this.checkpointHeaders.get(pending.stopHeight)
    if (ckpt && !equalBytes(ckpt, prev)) {
      console.warn(`[cfilter] cfheaders checkpoint mismatch at h=${pending.stopHeight} — peer dishonest`)
      return
    }

    console.log(`[cfheaders] processed checkpoint until: ${pending.startHeight}`)

    this.cfHeadersWalkStart = pending.stopHeight + 1
    this.walkCFHeadersNext()
  }

  // ── cfilter scan ──────────────────────────────────────────────────────────

  private startCFilterScan(): void {
    this.phase = 'cfilters'
    this.cfilterCursor = Math.max(this.birthdayHeight, this.cfilterCursor, this.anchorHeight + 1)
    console.log(`[cfilter] scanning ${this.cfilterCursor}..${this.effectiveScanTipHeight()}`)
    this.emit('cfilters')
    this.pumpCFilters()
  }

  private dispatchCFilterBatch(batch: CFilterBatch): void {
    const racers = [...this.filterCapablePeers]
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
      if (!this.inflightBatches.has(batch.startHeight) || this.stopped) return
      if (batch.remaining.size === 0) return
      console.warn(`[cfilter] batch ${batch.startHeight}..${batch.stopHeight} stuck (${batch.remaining.size}) — re-racing`)
      this.dispatchCFilterBatch(batch)
      this.armCFilterBatchTimer(batch)
    }, CFILTER_BATCH_TIMEOUT_MS)
  }

  private pumpCFilters(): void {
    if (this.stopped) return
    const effectiveTip = this.effectiveScanTipHeight()
    while (this.cfilterCursor <= effectiveTip && this.inflightBatches.size < MAX_INFLIGHT_BATCHES) {
      const startHeight = this.cfilterCursor
      const stopHeight = Math.min(startHeight + CFILTER_BATCH - 1, effectiveTip)
      const stopHashWire = this.heightToBlockHash.get(stopHeight)
      if (!stopHashWire) break
      const remaining = new Set<number>()
      for (let h = startHeight; h <= stopHeight; h++) remaining.add(h)
      const batch: CFilterBatch = {startHeight, stopHeight, stopHashWire, remaining, timer: null}
      this.inflightBatches.set(startHeight, batch)
      this.dispatchCFilterBatch(batch)
      this.armCFilterBatchTimer(batch)
      this.cfilterCursor = stopHeight + 1
    }
    if (this.cfilterCursor > effectiveTip && this.inflightBatches.size === 0) {
      this.maybeDrainAndFinish().catch(err => console.error('[cfilter] drain failed:', err))
    }
  }

  private async maybeDrainAndFinish(): Promise<void> {
    if (this.phase !== 'cfilters') return
    if (this.cfilterCursor <= this.effectiveScanTipHeight()) return
    if (this.inflightBatches.size > 0) return
    if (this.blockRequestsInflight.size > 0) {
      const waiting = [...this.blockRequestsInflight.values()].map(r => r.height).sort((a, b) => a - b)
      console.log(`[cfilters] scan reached tip; waiting on ${waiting.length} block(s): ${waiting.slice(0, 10).join(',')}${waiting.length > 10 ? '…' : ''}`)
      return
    }
    const sortedHeights = [...this.matchedBlocks.keys()].sort((a, b) => a - b)
    for (const h of sortedHeights) {
      await this.applyBlock(this.matchedBlocks.get(h)!, h)
    }
    this.matchedBlocks.clear()
    await this.chainDAO.setCFilterCursor(this.network, this.effectiveScanTipHeight())
    this.finishScan()
  }

  private onCFilter(msg: CFilterArgs): void {
    const blockHashWire = msg.blockHash ?? new Uint8Array(32)
    const height = this.wireHexToHeight.get(bytesToHex(blockHashWire)) ?? -1
    if (height < 0) return
    let owner: CFilterBatch | undefined
    for (const b of this.inflightBatches.values()) {
      if (b.remaining.has(height)) { owner = b; break }
    }
    if (!owner) return
    owner.remaining.delete(height)

    const cf = new CompactFilter(msg.filter ?? new Uint8Array(0), blockHashWire)
    if (cf.matchAny(this.watchedItems)) {
      console.log(`[cfilter] match h=${height} block=${wireToDisplayHex(blockHashWire).slice(0, 16)}…`)
      this.requestFullBlock(height, blockHashWire)
    }

    if (owner.remaining.size === 0) {
      if (owner.timer) clearTimeout(owner.timer)
      this.inflightBatches.delete(owner.startHeight)
      if (height % 5000 < CFILTER_BATCH) {
        console.log(`[cfilters] batch ${owner.startHeight}..${owner.stopHeight} done  inflight-batches=${this.inflightBatches.size}`)
      }
      if (this.phase === 'cfilters') this.pumpCFilters()
    }
  }

  private requestFullBlock(height: number, blockHashWire: Uint8Array): void {
    const key = bytesToHex(blockHashWire)
    if (this.blockRequestsInflight.has(key)) return
    const target = this.pickBlockPeer(new Set())
    if (!target) return
    const entry: {
      hashWire: Uint8Array
      height: number
      triedPeers: Set<Peer>
      timer: ReturnType<typeof setTimeout> | null
    } = {
      hashWire: blockHashWire,
      height,
      triedPeers: new Set([target]),
      timer: null,
    }
    this.blockRequestsInflight.set(key, entry)
    target.sendMessage(this.M.GetData([{type: Inventory.TYPE.BLOCK, hash: blockHashWire}]))
    this.armBlockRequestTimer(key, entry)
  }

  private pickBlockPeer(exclude: Set<Peer>): Peer | undefined {
    for (const p of this.readyPeers) {
      if (!exclude.has(p)) return p
    }
    return undefined
  }

  private armBlockRequestTimer(
    key: string,
    entry: NonNullable<ReturnType<Map<string, {
      hashWire: Uint8Array
      height: number
      triedPeers: Set<Peer>
      timer: ReturnType<typeof setTimeout> | null
    }>['get']>>,
  ): void {
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      if (this.stopped) return
      if (!this.blockRequestsInflight.has(key)) return
      const next = this.pickBlockPeer(entry.triedPeers)
      if (!next) {
        // Tried everyone; clear triedPeers and try again from any ready peer.
        entry.triedPeers.clear()
        const fallback = this.pickBlockPeer(entry.triedPeers)
        if (!fallback) return
        entry.triedPeers.add(fallback)
        console.warn(`[cfilter] block h=${entry.height} retry — no fresh peers, re-asking ${fallback.host}`)
        fallback.sendMessage(this.M.GetData([{type: Inventory.TYPE.BLOCK, hash: entry.hashWire}]))
        this.armBlockRequestTimer(key, entry)
        return
      }
      entry.triedPeers.add(next)
      console.warn(`[cfilter] block h=${entry.height} timeout — retrying via ${next.host} (tried ${entry.triedPeers.size})`)
      next.sendMessage(this.M.GetData([{type: Inventory.TYPE.BLOCK, hash: entry.hashWire}]))
      this.armBlockRequestTimer(key, entry)
    }, BLOCK_REQUEST_TIMEOUT_MS)
  }

  private async applyBlock(block: Block, height: number): Promise<void> {
    const spends: Array<{ txid: string; vout: number }> = []
    const received: PersistedUtxo[] = []
    let mutated = false

    for (const tx of block.txs) {
      const txid = tx.hash()
      for (const input of tx.inputs) {
        const k = `${input.txId}:${input.vOut}`
        const u = this.utxos.get(k)
        if (u) {
          spends.push({txid: u.txid, vout: u.vout})
          this.utxos.delete(k)
          mutated = true
          console.log(`[cfilter] spent ${u.txid.slice(0, 16)}…:${u.vout} -${u.satoshis} h=${height}`)
        }
      }
      for (let vout = 0; vout < tx.outputs.length; vout++) {
        const output = tx.outputs[vout]!
        const address = output.getAddress(this.network === 'mainnet' ? 'Mainnet' : 'Testnet')
        if (!address || !this.watchedAddressSet.has(address)) continue
        const k = `${txid}:${vout}`
        if (this.seenOwnOutpoints.has(k)) continue
        this.seenOwnOutpoints.add(k)
        const u: PersistedUtxo = {
          txid,
          vout,
          satoshis: output.satoshis.toString(),
          address,
          height,
        }
        this.utxos.set(k, u)
        received.push(u)
        mutated = true
        // From now on a spend of this output also matches the filter.
        this.watchedItems.push(bip158Outpoint(txid, vout))
        console.log(`[cfilter] received ${txid.slice(0, 16)}…:${vout} +${u.satoshis} h=${height} (${address})`)
      }
    }

    if (mutated) {
      await this.chainDAO.applyBlockUtxos(this.network, spends, received, height)
      this.emitUtxosCb([...this.utxos.values()])
    }
  }

  private finishScan(): void {
    if (this.stopped) return
    const balance = [...this.utxos.values()].reduce((s, u) => s + BigInt(u.satoshis), 0n)
    console.log(`[cfilter] scan complete utxos=${this.utxos.size} balance=${balance.toString()} sats`)
    this.emit('synced')
  }
}