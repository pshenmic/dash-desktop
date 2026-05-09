// Compact-filter (BIP 157/158) UTXO scan worker. Phases:
//   1. cfcheckpt   anchor filter-header chain at every 1000-block boundary
//   2. cfheaders   walk birthday→tip, derive filter headers locally, verify
//                  against checkpoints; persist to chain.db (network-shared)
//   3. cfilters    pull GCS payloads, match watched scripts/outpoints, fetch
//                  matched blocks, apply tx effects to the per-wallet UTXO set
//
// Persists to chain.db:
//   - f:<height>           filter headers (network-scoped, reusable)
//   - n:<height>           wire-byte block hashes (network-scoped)
//   - u:<walletId>:…       UTXOs (per-wallet)
//   - cfcursor:<walletId>  resume marker (per-wallet)

import {
  CompactFilter,
  Inventory,
  type CFCheckptArgs,
  type CFHeadersArgs,
  type CFilterArgs,
  type Message,
  type Peer,
} from 'dash-core-p2p'
import {Block, utils as sdkUtils} from 'dash-core-sdk'
// @ts-ignore — no bundled types for @dashevo/x11-hash-js
import x11 from '@dashevo/x11-hash-js'
import {Network} from '../../src/types'
import {PersistedHeader, PersistedUtxo} from '../ChainDAO'
import {ChainStore} from '../ChainStore'
import {PeerPool} from '../PeerPool'
import {GENESIS_HASH} from '../genesis'
import {Worker} from './Worker'

const {doubleSHA256, hexToBytes, bytesToHex, addressToPublicKeyHash} = sdkUtils

const FILTER_TYPE = 0
const CFILTER_BATCH = 800
const CFCHECKPT_RACE_PEERS = 12
const CFCHECKPT_RACE_TIMEOUT_MS = 15_000
const CFHEADERS_RACE_TIMEOUT_MS = 15_000
const CFILTER_BATCH_TIMEOUT_MS = 15_000
const BLOCK_REQUEST_TIMEOUT_MS = 15_000
const MAX_INFLIGHT_BATCHES = 4
const SCAN_TIP_DEPTH = 100

export type CFilterPhase =
  | 'connecting'
  | 'cfcheckpt'
  | 'cfheaders'
  | 'cfilters'
  | 'synced'
  | 'stopped'

export interface CFilterSyncWorkerStatus {
  phase: CFilterPhase
  cfheadersHeight: number
  cfilterScanHeight: number
  utxoCount: number
  totalBalance: string
  matchedBlocksPending: number
  peerCount: number
  filterCapablePeerCount: number
}

export interface CFilterSyncWorkerOptions {
  network: Network
  walletId: string
  chainStore: ChainStore
  peerPool: PeerPool
  chainTipHeight: number
  chainTipHashDisplayHex: string
  watchAddresses: string[]
  birthdayHeight: number
}

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

export class CFilterSyncWorker extends Worker {
  readonly name = 'CFilterSyncWorker'

  private network: Network
  private walletId: string
  private chainStore: ChainStore
  private peerPool: PeerPool

  private chainTipHeight: number
  private chainTipWire: Uint8Array
  private birthdayHeight: number

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly M: any

  private phase: CFilterPhase = 'connecting'
  private stopped = false
  private leader: Peer | null = null

  private heightToBlockHash = new Map<number, Uint8Array>()
  private wireHexToHeight = new Map<string, number>()
  private heightToFilterHeader = new Map<number, Uint8Array>()
  private checkpointHeaders = new Map<number, Uint8Array>()
  private anchorHeight = -1

  private watchedItems: Uint8Array[] = []
  private watchedAddressSet = new Set<string>()

  private cfcheckptResponded = false
  private cfcheckptRaceTimer: ReturnType<typeof setTimeout> | null = null
  private cfcheckptTriedPeers = new Set<Peer>()

  private cfHeadersWalkStart = 0
  private pendingCFHeaders = new Map<number, {
    startHeight: number
    stopHeight: number
    raceTimer: ReturnType<typeof setTimeout> | null
  }>()

  private cfilterCursor = 0
  private inflightBatches = new Map<number, CFilterBatch>()
  private blockRequestsInflight = new Map<string, BlockRequest>()
  private matchedBlocks = new Map<number, Block>()

  private utxos = new Map<string, PersistedUtxo>()
  private seenOwnOutpoints = new Set<string>()

  // Bound listener references — kept as fields so stop() can detach.
  private onPeerReady = (peer: Peer): void => this.handlePeerReady(peer)
  private onPeerDisconnect = (peer: Peer): void => this.handlePeerDisconnect(peer)
  private onPeerCheckpt = (peer: Peer, msg: Message): void =>
    this.onCheckpoints(msg as Message & CFCheckptArgs, peer)
  private onPeerCFHeaders = (peer: Peer, msg: Message): void =>
    this.onCFHeaders(msg as Message & CFHeadersArgs, peer)
  private onPeerCFilter = (_peer: Peer, msg: Message): void =>
    this.onCFilter(msg as Message & CFilterArgs)
  private onPeerBlock = (peer: Peer, msg: Message & { block?: unknown }): void =>
    this.handlePeerBlock(peer, msg)

  constructor(opts: CFilterSyncWorkerOptions) {
    super()
    this.network = opts.network
    this.walletId = opts.walletId
    this.chainStore = opts.chainStore
    this.peerPool = opts.peerPool
    this.chainTipHeight = opts.chainTipHeight
    this.chainTipWire = displayHexToWire(opts.chainTipHashDisplayHex)
    this.birthdayHeight = Math.max(1, opts.birthdayHeight)

    for (const a of opts.watchAddresses) {
      this.watchedAddressSet.add(a)
      this.watchedItems.push(p2pkhScript(a))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.M = this.peerPool.messages as any
  }

  start = async (): Promise<void> => {
    // Restore prior progress (per-wallet state).
    const cursor = await this.chainStore.getCFilterCursor(this.walletId)
    const persistedUtxos = await this.chainStore.getAllUtxos(this.walletId)
    for (const u of persistedUtxos) {
      const k = `${u.txid}:${u.vout}`
      this.utxos.set(k, u)
      this.seenOwnOutpoints.add(k)
      this.watchedItems.push(bip158Outpoint(u.txid, u.vout))
    }
    if (persistedUtxos.length > 0) this.emit('utxos', persistedUtxos)

    const resumeHeight = cursor != null ? Math.max(this.birthdayHeight, cursor + 1) : this.birthdayHeight
    this.cfilterCursor = resumeHeight

    await this.buildChainIndex()

    // Seed genesis (height 1) into the index — HeaderSync starts WITH this
    // header as its tip and only persists subsequent ones, so it's not in
    // chain.db.
    const genesisWire = displayHexToWire(GENESIS_HASH[this.network])
    this.heightToBlockHash.set(1, genesisWire)
    this.wireHexToHeight.set(bytesToHex(genesisWire), 1)

    // Network-shared filter-header cache.
    const cachedFilterHeaders = await this.chainStore.iterateFilterHeadersInRange(1, this.chainTipHeight)
    for (const {height, header} of cachedFilterHeaders) {
      this.heightToFilterHeader.set(height, header)
    }
    if (cachedFilterHeaders.length > 0) {
      console.log(`[cfilter] loaded ${cachedFilterHeaders.length} filter headers from cache`)
    }

    // Subscribe to peer events from the shared pool.
    this.peerPool.on('peerready', this.onPeerReady)
    this.peerPool.on('peerdisconnect', this.onPeerDisconnect)
    this.peerPool.on('peercfcheckpt', this.onPeerCheckpt)
    this.peerPool.on('peercfheaders', this.onPeerCFHeaders)
    this.peerPool.on('peercfilter', this.onPeerCFilter)
    this.peerPool.on('peerblock', this.onPeerBlock)

    this.emitStatus('connecting')

    // Already-ready filter-capable peers? Kick off cfcheckpt now.
    if (this.peerPool.filterCapablePeers.size > 0) this.requestCheckpoints()
  }

  stop = (): void => {
    if (this.stopped) return
    this.stopped = true
    this.clearTimers()
    this.peerPool.off('peerready', this.onPeerReady)
    this.peerPool.off('peerdisconnect', this.onPeerDisconnect)
    this.peerPool.off('peercfcheckpt', this.onPeerCheckpt)
    this.peerPool.off('peercfheaders', this.onPeerCFHeaders)
    this.peerPool.off('peercfilter', this.onPeerCFilter)
    this.peerPool.off('peerblock', this.onPeerBlock)
    this.phase = 'stopped'
    this.emitStatus('stopped')
  }

  // Called by the Orchestrator when HeaderSyncWorker emits 'chainExtended'.
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
    if (this.phase !== 'synced' && this.phase !== 'cfilters') return
    if (this.cfilterCursor <= this.effectiveScanTipHeight()) {
      if (this.phase === 'synced') this.emitStatus('cfilters')
      this.phase = 'cfilters'
      this.pumpCFilters()
    }
  }

  // Hot-add of newly created wallet addresses. Cursor is rewound to birthday
  // so historical filters are re-matched against the new addresses.
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

    for (const b of this.inflightBatches.values()) {
      if (b.timer) clearTimeout(b.timer)
    }
    this.inflightBatches.clear()
    this.matchedBlocks.clear()
    this.cfilterCursor = this.birthdayHeight

    if (this.phase === 'cfheaders' || this.phase === 'cfcheckpt' || this.phase === 'connecting') {
      return
    }
    if (this.heightToFilterHeader.size === 0) {
      this.requestCheckpoints()
      return
    }
    this.phase = 'cfilters'
    this.emitStatus('cfilters')
    this.pumpCFilters()
  }

  // ── status ────────────────────────────────────────────────────────────────

  private emitStatus(phase: CFilterPhase): void {
    this.phase = phase
    let totalBalance = 0n
    for (const u of this.utxos.values()) totalBalance += BigInt(u.satoshis)
    const matchedBlocksPending = this.matchedBlocks.size + this.blockRequestsInflight.size
    const status: CFilterSyncWorkerStatus = {
      phase,
      cfheadersHeight: Math.max(0, this.cfHeadersWalkStart - 1),
      cfilterScanHeight: Math.max(0, this.cfilterCursor - 1),
      utxoCount: this.utxos.size,
      totalBalance: totalBalance.toString(),
      matchedBlocksPending,
      peerCount: this.peerPool.readyPeers.size,
      filterCapablePeerCount: this.peerPool.filterCapablePeers.size,
    }
    this.emit('status', status)
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

  // ── chain index ───────────────────────────────────────────────────────────

  private async buildChainIndex(): Promise<void> {
    // Always cover the full chain (1..chainTip). Optimizing to a narrow
    // resume window breaks cfcheckpt's stop-hash lookup and addWatchAddresses
    // re-scan from birthday. The n: cache makes this a fast range scan.
    const from = 1
    const to = this.chainTipHeight
    const expected = to - from + 1
    console.log(`[cfilter] building chain index ${from}..${to}`)

    const cached = await this.chainStore.iterateHashesInRange(from, to)
    if (cached.length === expected) {
      for (const {height, wire} of cached) {
        this.heightToBlockHash.set(height, wire)
        this.wireHexToHeight.set(bytesToHex(wire), height)
      }
      console.log(`[cfilter] chain index loaded from cache (${cached.length} entries)`)
      this.ensureTipInIndex()
      return
    }

    // Fallback: x11 + backfill. One-time cost on chain.db that predates the
    // n: keyspace.
    console.log(`[cfilter] no hash cache (${cached.length}/${expected}); hashing + backfilling`)
    const cachedByHeight = new Map<number, Uint8Array>()
    for (const {height, wire} of cached) cachedByHeight.set(height, wire)

    const headers = await this.chainStore.iterateHeadersInRange(from, to)
    let processed = 0
    let backfill: Array<{height: number; wire: Uint8Array}> = []
    for (const {height, raw} of headers) {
      const wire = cachedByHeight.get(height) ?? x11Wire(raw)
      this.heightToBlockHash.set(height, wire)
      this.wireHexToHeight.set(bytesToHex(wire), height)
      if (!cachedByHeight.has(height)) backfill.push({height, wire})
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
    this.ensureTipInIndex()
  }

  private ensureTipInIndex(): void {
    if (!this.heightToBlockHash.has(this.chainTipHeight)) {
      this.heightToBlockHash.set(this.chainTipHeight, this.chainTipWire)
      this.wireHexToHeight.set(bytesToHex(this.chainTipWire), this.chainTipHeight)
    }
  }

  private effectiveScanTipHeight(): number {
    return Math.max(this.birthdayHeight, this.chainTipHeight - SCAN_TIP_DEPTH)
  }

  private cfcheckptStopHeight(): number {
    return Math.floor(this.effectiveScanTipHeight() / 1000) * 1000
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

  private handlePeerBlock(peer: Peer, message: Message & { block?: unknown }): void {
    if (this.stopped) return
    const block = message.block as Block | undefined
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
    let candidates = [...this.peerPool.filterCapablePeers].filter(p => !this.cfcheckptTriedPeers.has(p))
    if (candidates.length === 0) {
      this.cfcheckptTriedPeers.clear()
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
      this.cfcheckptTriedPeers.add(p)
      p.sendMessage(msg)
    }
    if (this.cfcheckptRaceTimer) clearTimeout(this.cfcheckptRaceTimer)
    this.cfcheckptRaceTimer = setTimeout(() => {
      if (this.cfcheckptResponded || this.stopped) return
      console.warn('[cfilter] cfcheckpt timeout — rotating')
      this.requestCheckpoints()
    }, CFCHECKPT_RACE_TIMEOUT_MS)
    this.emitStatus('cfcheckpt')
  }

  private onCheckpoints(msg: CFCheckptArgs, fromPeer: Peer): void {
    if (this.stopped) return
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
      for (const h of [...this.heightToFilterHeader.keys()]) {
        if (h >= firstBadCheckpoint) this.heightToFilterHeader.delete(h)
      }
      this.chainStore.deleteFilterHeadersFrom(firstBadCheckpoint).catch(err =>
        console.error('[cfilter] failed to drop stale filter headers:', err)
      )
    }

    const start = Math.max(this.birthdayHeight, this.cfilterCursor)
    const anchorCkpt = Math.floor((start - 1) / 1000) * 1000
    if (anchorCkpt > 0 && this.checkpointHeaders.has(anchorCkpt)) {
      this.anchorHeight = anchorCkpt
      this.heightToFilterHeader.set(anchorCkpt, this.checkpointHeaders.get(anchorCkpt)!)
    } else {
      this.anchorHeight = 0
    }
    console.log(`[cfilter] received ${headers.length} checkpoints; anchor at h=${this.anchorHeight}; cached headers=${this.heightToFilterHeader.size}`)
    this.cfHeadersWalkStart = Math.max(this.anchorHeight + 1, this.birthdayHeight)
    this.walkCFHeadersNext()
  }

  // ── cfheaders walk ────────────────────────────────────────────────────────

  private walkCFHeadersNext(): void {
    if (this.stopped) return
    const effectiveTip = this.effectiveScanTipHeight()

    while (this.cfHeadersWalkStart <= effectiveTip) {
      const startHeight = this.cfHeadersWalkStart
      const nextCkpt = (Math.floor((startHeight - 1) / 1000) + 1) * 1000
      const stopHeight = Math.min(nextCkpt, effectiveTip)
      let fullyCached = true
      for (let h = startHeight; h <= stopHeight; h++) {
        if (!this.heightToFilterHeader.has(h)) { fullyCached = false; break }
      }
      if (!fullyCached) break
      this.cfHeadersWalkStart = stopHeight + 1
    }

    if (this.cfHeadersWalkStart > effectiveTip) {
      console.log('[cfilter] cfheaders complete (cached); starting cfilter scan')
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

    const racers = [...this.peerPool.filterCapablePeers]
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
    if (this.stopped) return
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
    const derived: Array<{ height: number; header: Uint8Array }> = []
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
      console.warn(`[cfilter] cfheaders checkpoint mismatch at h=${pending.stopHeight} — peer dishonest`)
      return
    }

    for (const e of derived) this.heightToFilterHeader.set(e.height, e.header)
    this.chainStore.writeFilterHeaders(derived).catch(err =>
      console.error('[cfilter] failed to persist filter headers:', err)
    )

    console.log(`[cfheaders] processed checkpoint until: ${pending.startHeight}`)

    this.cfHeadersWalkStart = pending.stopHeight + 1
    this.walkCFHeadersNext()
  }

  // ── cfilter scan ──────────────────────────────────────────────────────────

  private startCFilterScan(): void {
    this.phase = 'cfilters'
    this.cfilterCursor = Math.max(this.birthdayHeight, this.cfilterCursor, this.anchorHeight + 1)
    console.log(`[cfilter] scanning ${this.cfilterCursor}..${this.effectiveScanTipHeight()}`)
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
    await this.chainStore.setCFilterCursor(this.walletId, this.effectiveScanTipHeight())
    this.finishScan()
  }

  private onCFilter(msg: CFilterArgs): void {
    if (this.stopped) return
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
      if (this.phase === 'cfilters') {
        this.emitStatus('cfilters')
        this.pumpCFilters()
      }
    }
  }

  private requestFullBlock(height: number, blockHashWire: Uint8Array): void {
    const key = bytesToHex(blockHashWire)
    if (this.blockRequestsInflight.has(key)) return
    const target = this.pickBlockPeer(new Set())
    if (!target) return
    const entry: BlockRequest = {
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
    for (const p of this.peerPool.readyPeers) {
      if (!exclude.has(p)) return p
    }
    return undefined
  }

  private armBlockRequestTimer(key: string, entry: BlockRequest): void {
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      if (this.stopped) return
      if (!this.blockRequestsInflight.has(key)) return
      const next = this.pickBlockPeer(entry.triedPeers)
      if (!next) {
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
        this.watchedItems.push(bip158Outpoint(txid, vout))
        console.log(`[cfilter] received ${txid.slice(0, 16)}…:${vout} +${u.satoshis} h=${height} (${address})`)
      }
    }

    if (mutated) {
      await this.chainStore.applyBlockUtxos(this.walletId, spends, received, height)
      this.emit('utxos', [...this.utxos.values()])
    }
  }

  private finishScan(): void {
    if (this.stopped) return
    const balance = [...this.utxos.values()].reduce((s, u) => s + BigInt(u.satoshis), 0n)
    console.log(`[cfilter] scan complete utxos=${this.utxos.size} balance=${balance.toString()} sats`)
    this.emitStatus('synced')
  }
}