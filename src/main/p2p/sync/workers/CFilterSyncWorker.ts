// Compact-filter (BIP 157/158) UTXO scan worker, in three phases: cfcheckpt
// anchors the filter-header chain every 1000 blocks, cfheaders walks
// birthday→tip deriving headers locally and verifying them against those
// anchors, cfilters pulls GCS payloads and fetches the blocks that match.
//
// Only network-scoped data reaches chain.db (f: filter headers, n: wire-byte
// block hashes). Wallet state stays in SQL: the worker emits blockApplied /
// cursorAdvanced and main persists them.

import {FilterMatcher} from 'crypto-toothpick'
import {
  type CFCheckptArgs,
  type CFHeadersArgs,
  type CFilterArgs,
  GCS_M, GCS_P,
  type Message,
  type Peer,
} from 'dash-core-p2p'
import {Block, utils as sdkUtils} from 'dash-core-sdk'
import {Network} from '../../../src/types/Network'
import {ChainStore} from '../../store/ChainStore'
import {PoolService} from '../../net/PoolService'
import {WatchSet} from '../WatchSet'
import {BlockFetcher} from '../blockFetcher'
import {displayHexToWire, wireToDisplayHex} from '../../utils/byteOrder'
import {formatChainDbError} from '../../store/chainDbError'
import {CheckpointAnchors} from '../checkpointAnchors'
import {HashIndex} from '../../store/hashIndex'
import {PeerRotation} from '../../net/peerRotation'
import {x11Wire} from '../../utils/x11'
import {GENESIS, MB} from '../../constants'
import type {AppliedBlock, WalletSyncUtxo, WatchAddress} from '../../types/walletSync'
import type {
  CFilterBatch,
  CFilterPhase,
  CFilterSyncWorkerOptions,
  CFilterSyncWorkerStatus,
  PendingCFHeaders,
} from '../../types/cfilterSync'
import {
  CFHEADERS_RACE_PEERS,
  CFHEADERS_RACE_TIMEOUT_MS,
  CFILTER_BATCH,
  CFILTER_BATCH_PEERS,
  CFILTER_BATCH_TIMEOUT_MS,
  FILTER_TYPE,
  MAX_INFLIGHT_BATCHES,
  MAX_INFLIGHT_CFHEADERS,
  SCAN_TIP_DEPTH,
} from '../../constants'
import {Worker} from './Worker'
import {PersistedHeader} from '../../types/chainStore'

const {doubleSHA256, bytesToHex} = sdkUtils

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}


// `external`+`arrayBuffers` are reported because they cover the off-heap
// typed-array backing stores that `ps rss` under-counts.
function logMem(label: string): void {
  const m = process.memoryUsage()
  console.log(
    `[p2p-mem] ${label}: rss=${(m.rss / MB).toFixed(0)}MB heapUsed=${(m.heapUsed / MB).toFixed(0)}MB ` +
    `external=${(m.external / MB).toFixed(0)}MB arrayBuffers=${(m.arrayBuffers / MB).toFixed(0)}MB`,
  )
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
  // Whoever last served filter data. Its disconnect mid-cfcheckpt is what
  // re-races the anchors rather than waiting out the timer.
  private leader: Peer | null = null

  // ── chain index (height → wire-byte hash) ────────────────────────────────
  // Forward only. The reverse lookup comes from bounded inflight state — block
  // fetches carry their height, cfilter batches register their hashes, cfheaders
  // match the few pending stop-hashes — dropping a ~250MB full-chain map.
  private readonly blockHashIndex: HashIndex
  private cfilterInflightHeights = new Map<string, number>()

  // cf* requests race the filter-capable subset; blocks come from any ready
  // peer, but the sockets that go silent are the same ones, so blockRotation
  // shares nothing but its source with the cf* one.
  private readonly rotation: PeerRotation
  private readonly blockRotation: PeerRotation

  // ── filter-header chain ──────────────────────────────────────────────────
  private readonly heightToFilterHeader: HashIndex
  private readonly checkpoints: CheckpointAnchors
  private anchorHeight = -1

  // ── watch set (cfilter inputs) ──────────────────────────────────────────
  private readonly watchSet: WatchSet

  private matcher: FilterMatcher | null = null
  private matcherRevision = -1
  // Height of the last block applied before the gap ran out. Non-null means the
  // scan is held and pumpCFilters is a no-op.
  private gapPausedAt: number | null = null
  // Held between a rewind and main's reseedUtxos answer: the spend map it
  // matches against still reflects orphaned blocks.
  private awaitingReseed = false
  private draining = false

  // ── per-phase state ─────────────────────────────────────────────────────
  private readonly blockFetcher: BlockFetcher

  private cfHeaders = {
    walkStart: 0,
    pending: new Map<number, PendingCFHeaders>(),
  }

  private cfilter = {
    cursor: 0,
    inflightBatches: new Map<number, CFilterBatch>(),
  }

  private matchedBlocks = new Map<number, Block>()

  // Bound peer-event listeners. Stable references kept for stop()'s off().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly peerListeners: Array<[string, (...args: any[]) => void]> = [
    ['peerready', (p: Peer) => this.handlePeerReady(p)],
    ['peerdisconnect', (p: Peer) => this.handlePeerDisconnect(p)],
    ['peercfcheckpt', (p: Peer, m: Message) => this.checkpoints.receive(m as Message & CFCheckptArgs, p)],
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
    this.blockHashIndex = new HashIndex(opts.chainTipHeight)
    this.heightToFilterHeader = new HashIndex(opts.chainTipHeight)
    this.birthdayHeight = Math.max(1, opts.birthdayHeight)
    this.seedUtxos = opts.seedUtxos
    this.initialCfilterCursor = opts.cfilterCursor
    this.watchSet = new WatchSet(opts.network, opts.gapLimit, opts.watchAddresses)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.M = this.peerPool.messages as any

    this.rotation = new PeerRotation(() => this.peerPool.filterCapablePeers)
    this.blockRotation = this.rotation.over(() => this.peerPool.readyPeers)
    this.blockFetcher = new BlockFetcher({rotation: this.blockRotation, messages: this.M})
    this.checkpoints = new CheckpointAnchors({
      rotation: this.rotation,
      messages: this.M,
      stopHashAt: height => this.blockHashIndex.get(height),
      onReady: (headers, fromPeer) => this.onCheckpointsReady(headers, fromPeer),
    })
  }

  start = async (): Promise<void> => {
    // Restore prior per-wallet state from seed (sourced from SQL by main).
    this.watchSet.setUtxos(this.seedUtxos)

    this.cfilter.cursor = this.initialCfilterCursor != null
      ? Math.max(this.birthdayHeight, this.initialCfilterCursor + 1)
      : this.birthdayHeight

    await this.buildChainIndex()
    logMem('after buildChainIndex')

    // HeaderSync starts WITH genesis as its tip and persists only what follows,
    // so height 1 is never in chain.db.
    this.setHashIndex(1, displayHexToWire(GENESIS[this.network].hash))

    // Streamed for the same reason as forEachHashInRange.
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
    this.checkpoints.stop()
    this.blockFetcher.stop()
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

  // Everything above `forkHeight` is orphaned, so the filter headers and matched
  // blocks derived from it go, and the scan holds until main reseeds the UTXOs.
  onChainRewound = (forkHeight: number): void => {
    if (this.stopped) return
    console.warn(`[cfilter] chain rewound to h=${forkHeight} — dropping derived state above it`)

    this.clearTimers()
    this.matchedBlocks.clear()

    this.heightToFilterHeader.deleteFrom(forkHeight + 1)
    this.chainStore.deleteFilterHeadersFrom(forkHeight + 1).catch(err => {
      console.error('[cfilter] failed to drop filter headers above the fork:', err)
      this.reportError(formatChainDbError(err), false)
    })

    this.chainTipHeight = forkHeight
    this.cfilter.cursor = Math.min(this.cfilter.cursor, forkHeight + 1)
    this.cfHeaders.walkStart = Math.min(this.cfHeaders.walkStart, forkHeight + 1)
    this.awaitingReseed = true

    this.emit('cursorReset', {walletId: this.walletId, height: forkHeight})
  }

  reseedUtxos = (utxos: WalletSyncUtxo[]): void => {
    if (this.stopped) return
    this.watchSet.setUtxos(utxos)
    this.awaitingReseed = false
    console.log(`[cfilter] reseeded ${utxos.length} utxo(s) after rewind — resuming at h=${this.cfilter.cursor}`)
    if (this.phase === 'synced') this.emitStatus('cfilters')
    this.pumpCFilters()
  }

  // rewindToHeight set means the addresses may carry past on-chain activity, so
  // historical filters get re-matched. Omitted means main proved them fresh
  // (frontier-derived, or added while synced) and the match set just widens.
  addWatchAddresses = (addresses: WatchAddress[], rewindToHeight?: number): void => {
    if (this.stopped) return
    let added = 0
    for (const a of addresses) if (this.watchSet.add(a)) added++

    if (this.gapPausedAt != null) {
      const still = this.watchSet.exhaustedChain()
      if (still != null) {
        console.warn(`[cfilter] +${added} address(es) but ${still} gap still short — scan stays held at h=${this.gapPausedAt}`)
        return
      }
      const resumeAt = this.gapPausedAt + 1
      this.gapPausedAt = null
      console.log(`[cfilter] gap extended (+${added}, total ${this.watchSet.size}) — resuming scan at h=${resumeAt}`)
      this.emitStatus('cfilters')
      this.pumpCFilters()
      return
    }

    if (added === 0) return

    if (rewindToHeight != null) {
      const target = Math.max(this.birthdayHeight, rewindToHeight)
      console.log(`[cfilter] addWatchAddresses +${added} (total ${this.watchSet.size}); rewinding cursor to h=${target}`)
      for (const b of this.cfilter.inflightBatches.values()) if (b.timer) clearTimeout(b.timer)
      this.cfilter.inflightBatches.clear()
      this.cfilterInflightHeights.clear()
      this.matchedBlocks.clear()
      this.cfilter.cursor = target
      this.emit('cursorReset', {walletId: this.walletId, height: target})
    } else {
      console.log(`[cfilter] addWatchAddresses +${added} (total ${this.watchSet.size}); forward-only (no rewind)`)
    }

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
      matchedBlocksPending: this.matchedBlocks.size + this.blockFetcher.size,
      peerCount: this.peerPool.readyPeers.size,
      filterCapablePeerCount: this.peerPool.filterCapablePeers.size,
    } satisfies CFilterSyncWorkerStatus)
  }

  private setHashIndex(height: number, wire: Uint8Array): void {
    this.blockHashIndex.set(height, wire)
  }

  private clearTimers(): void {
    this.checkpoints.reset()
    for (const p of this.cfHeaders.pending.values()) if (p.raceTimer) clearTimeout(p.raceTimer)
    for (const b of this.cfilter.inflightBatches.values()) if (b.timer) clearTimeout(b.timer)
    this.blockFetcher.reset()
    this.cfHeaders.pending.clear()
    this.cfilter.inflightBatches.clear()
    this.cfilterInflightHeights.clear()
  }

  private effectiveScanTipHeight(): number {
    return Math.max(this.birthdayHeight, this.chainTipHeight - SCAN_TIP_DEPTH)
  }

  // ── chain index ───────────────────────────────────────────────────────────

  private async buildChainIndex(): Promise<void> {
    // Full chain, not a narrow resume window: that would break cfcheckpt's
    // stop-hash lookup and addWatchAddresses' re-scan from birthday.
    const from = 1
    const to = this.chainTipHeight
    const expected = to - from + 1
    console.log(`[cfilter] building chain index ${from}..${to}`)

    // Streamed, because the array form spikes hundreds of MB of transient
    // objects that V8 keeps resident afterward.
    const cachedCount = await this.chainStore.forEachHashInRange(
      from, to, (height, wire) => this.setHashIndex(height, wire),
    )
    if (cachedCount === expected) {
      console.log(`[cfilter] chain index loaded from cache (${cachedCount} entries)`)
    } else {
      // One-time cost on chain.db predating the n: keyspace.
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

  // A request whose last peer drops has nobody left to answer it. Waiting for
  // its timer to notice costs the full timeout per request, which on a churning
  // peer set is most of the sync.
  private handlePeerDisconnect(peer: Peer): void {
    this.rotation.forget(peer)
    if (peer === this.leader) {
      this.leader = null
      if (this.phase === 'cfcheckpt') this.requestCheckpoints()
    }

    for (const entry of this.cfHeaders.pending.values()) {
      if (!entry.inflightPeers.delete(peer) || entry.inflightPeers.size > 0) continue
      console.warn(`[cfilter] cfheaders ${entry.startHeight}..${entry.stopHeight} lost its last peer — re-racing`)
      this.dispatchCFHeaders(entry)
      this.armCFHeadersTimer(entry)
    }

    for (const batch of this.cfilter.inflightBatches.values()) {
      if (!batch.inflightPeers.delete(peer) || batch.inflightPeers.size > 0) continue
      if (batch.remaining.size === 0) continue
      console.warn(`[cfilter] batch ${batch.startHeight}..${batch.stopHeight} lost its last peer — re-racing`)
      this.dispatchCFilterBatch(batch)
      this.armCFilterBatchTimer(batch)
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
    const height = this.blockFetcher.receive(peer, displayHexToWire(blockHashHex))
    if (height == null) {
      console.warn(`[cfilter] peerblock from ${peer.host} unknown hash ${blockHashHex.slice(0, 16)}…`)
      return
    }
    console.log(`[cfilter] peerblock h=${height} from ${peer.host}  inflight-blocks=${this.blockFetcher.size}`)
    if (this.phase === 'cfilters') {
      this.matchedBlocks.set(height, block)
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
    if (this.checkpoints.request(this.effectiveScanTipHeight())) this.emitStatus('cfcheckpt')
  }

  // The anchors are in; reconcile the cached filter-header chain against them
  // and pick the height the walk starts from.
  private onCheckpointsReady(headers: Uint8Array[], fromPeer: Peer): void {
    this.leader = fromPeer

    // Cross-validate cached filter headers against checkpoints.
    let firstBadCheckpoint = Infinity
    for (const [ckptHeight, ckptHeader] of this.checkpoints.entries()) {
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
    if (anchorCkpt > 0 && this.checkpoints.has(anchorCkpt)) {
      this.anchorHeight = anchorCkpt
      this.heightToFilterHeader.set(anchorCkpt, this.checkpoints.get(anchorCkpt)!)
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
      // Everything is requested; the last chunk to land starts the scan.
      if (this.cfHeaders.pending.size === 0) {
        console.log('[cfilter] cfheaders complete; starting cfilter scan')
        this.startCFilterScan()
      }
      return
    }
    if (this.peerPool.filterCapablePeers.size === 0) {
      console.warn('[cfilter] cfheaders: no +CF peers — waiting')
      return
    }
    this.emitStatus('cfheaders')

    // Requested in parallel: each chunk sits between two cfcheckpt anchors, so
    // it is verified on arrival without the chunk below it.
    while (
      this.cfHeaders.walkStart <= effectiveTip &&
      this.cfHeaders.pending.size < MAX_INFLIGHT_CFHEADERS
    ) {
      const startHeight = this.cfHeaders.walkStart
      const nextCkpt = (Math.floor(startHeight / 1000) + 1) * 1000
      const stopHeight = Math.min(nextCkpt, effectiveTip)
      if (!this.blockHashIndex.has(stopHeight)) {
        console.warn(`[cfilter] cfheaders: no hash for h=${stopHeight}; stopping`)
        return
      }
      if (!this.cfHeaders.pending.has(stopHeight)) {
        const entry: PendingCFHeaders = {
          startHeight, stopHeight, triedPeers: new Set(), inflightPeers: new Set(), raceTimer: null,
        }
        this.cfHeaders.pending.set(stopHeight, entry)
        this.dispatchCFHeaders(entry)
        this.armCFHeadersTimer(entry)
      }
      this.cfHeaders.walkStart = stopHeight + 1
    }
  }

  private dispatchCFHeaders(entry: PendingCFHeaders): void {
    const stopHashWire = this.blockHashIndex.get(entry.stopHeight)
    if (!stopHashWire) return
    const picks = this.rotation.pick(CFHEADERS_RACE_PEERS, entry.triedPeers)
    const msg = this.M.GetCFHeaders({filterType: FILTER_TYPE, startHeight: entry.startHeight, stopHash: stopHashWire})
    entry.inflightPeers.clear()
    for (const p of picks) {
      entry.triedPeers.add(p)
      entry.inflightPeers.add(p)
      p.sendMessage(msg)
    }
  }

  private armCFHeadersTimer(entry: PendingCFHeaders): void {
    if (entry.raceTimer) clearTimeout(entry.raceTimer)
    entry.raceTimer = setTimeout(() => {
      if (!this.cfHeaders.pending.has(entry.stopHeight) || this.stopped) return
      console.warn(`[cfilter] cfheaders ${entry.startHeight}..${entry.stopHeight} timeout — re-racing`)
      this.rotation.markSilent(entry.inflightPeers)
      this.dispatchCFHeaders(entry)
      this.armCFHeadersTimer(entry)
    }, CFHEADERS_RACE_TIMEOUT_MS)
  }

  private onCFHeaders(msg: CFHeadersArgs, fromPeer: Peer): void {
    if (this.stopped) return
    const stopHashWire = msg.stopHash ?? new Uint8Array(32)
    // Matched against the few pending requests instead of a whole-chain
    // hash→height map.
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
    // Chunks break on checkpoint boundaries, so the height below a chunk is
    // itself a checkpoint for all but the first. Anchoring there rather than on
    // the derived chain is what lets chunks verify in any order.
    const prevExpected = this.checkpoints.get(pending.startHeight - 1)
      ?? this.heightToFilterHeader.get(pending.startHeight - 1)
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
    const ckpt = this.checkpoints.get(pending.stopHeight)
    if (ckpt && !equalBytes(ckpt, prev)) {
      console.warn(`[cfilter] cfheaders checkpoint mismatch at h=${pending.stopHeight} from ${fromPeer.host} — peer dishonest, re-racing`)
      this.dispatchCFHeaders(pending)
      this.armCFHeadersTimer(pending)
      return
    }

    if (pending.raceTimer) clearTimeout(pending.raceTimer)
    this.cfHeaders.pending.delete(pending.stopHeight)
    this.rotation.markResponsive(fromPeer)
    this.leader = fromPeer

    for (const e of derived) this.heightToFilterHeader.set(e.height, e.header)
    this.chainStore.writeFilterHeaders(derived).catch(err => {
      console.error('[cfilter] failed to persist filter headers:', err)
      this.reportError(formatChainDbError(err), false)
    })

    console.log(`[cfheaders] processed checkpoint until: ${pending.startHeight}`)

    this.emitStatus('cfheaders')
    this.walkCFHeadersNext()
  }

  // ── cfilter scan ──────────────────────────────────────────────────────────

  private startCFilterScan(): void {
    this.cfilter.cursor = Math.max(this.birthdayHeight, this.cfilter.cursor, this.anchorHeight + 1)
    this.emitStatus('cfilters')
    // Usage main already knew about can leave the gap short before a single
    // filter is matched; scanning on would repeat the miss.
    const exhausted = this.watchSet.exhaustedChain()
    if (exhausted != null) {
      this.holdForGap(exhausted, this.cfilter.cursor - 1)
      return
    }
    console.log(`[cfilter] scanning ${this.cfilter.cursor}..${this.effectiveScanTipHeight()}`)
    this.pumpCFilters()
  }

  private dispatchCFilterBatch(batch: CFilterBatch): void {
    const picks = this.rotation.pick(CFILTER_BATCH_PEERS, batch.triedPeers)
    if (picks.length === 0) return
    const msg = this.M.GetCFilters({
      filterType: FILTER_TYPE,
      startHeight: batch.startHeight,
      stopHash: batch.stopHashWire,
    })
    batch.inflightPeers.clear()
    for (const p of picks) {
      batch.triedPeers.add(p)
      batch.inflightPeers.add(p)
      p.sendMessage(msg)
    }
  }

  private armCFilterBatchTimer(batch: CFilterBatch): void {
    if (batch.timer) clearTimeout(batch.timer)
    batch.remainingAtArm = batch.remaining.size
    batch.timer = setTimeout(() => {
      if (!this.cfilter.inflightBatches.has(batch.startHeight) || this.stopped) return
      if (batch.remaining.size === 0) return

      // Filters landed during the interval, so the peer is delivering and only
      // needs longer. Re-racing here asks a second peer for the whole batch to
      // re-send what is already arriving.
      if (batch.remaining.size < batch.remainingAtArm) {
        this.armCFilterBatchTimer(batch)
        return
      }

      console.warn(`[cfilter] batch ${batch.startHeight}..${batch.stopHeight} stalled (${batch.remaining.size}) — re-racing`)
      this.rotation.markSilent(batch.inflightPeers)
      this.dispatchCFilterBatch(batch)
      this.armCFilterBatchTimer(batch)
    }, CFILTER_BATCH_TIMEOUT_MS)
  }

  private pumpCFilters(): void {
    if (this.stopped || this.gapPausedAt != null || this.awaitingReseed) return
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
      const batch: CFilterBatch = {
        startHeight, stopHeight, stopHashWire, remaining,
        triedPeers: new Set(), inflightPeers: new Set(), remainingAtArm: 0, timer: null,
      }
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

  // Highest height whose matched blocks have all arrived: no request still
  // outstanding can produce one below it.
  private settledHeight(): number {
    let lowest = Infinity
    for (const b of this.cfilter.inflightBatches.values()) lowest = Math.min(lowest, b.startHeight)
    lowest = Math.min(lowest, this.blockFetcher.lowestHeight())
    return lowest === Infinity ? this.effectiveScanTipHeight() : lowest - 1
  }

  // Applied in height order and only up to settledHeight, because spend
  // detection needs an output recorded before the block spending it. Draining as
  // the scan runs is what lets gap exhaustion be caught mid-scan rather than
  // after it — and it keeps matched blocks from piling up in memory.
  private async drainMatched(): Promise<void> {
    if (this.draining || this.gapPausedAt != null || this.awaitingReseed) return
    this.draining = true
    try {
      const settled = this.settledHeight()
      const heights = [...this.matchedBlocks.keys()].filter(h => h <= settled).sort((a, b) => a - b)
      for (const height of heights) {
        const block = this.matchedBlocks.get(height)!
        this.matchedBlocks.delete(height)
        await this.applyBlock(block, height)
        const exhausted = this.watchSet.exhaustedChain()
        if (exhausted != null) {
          this.holdForGap(exhausted, height)
          return
        }
      }
      if (settled > 0) this.emit('cursorAdvanced', {walletId: this.walletId, height: settled})
    } finally {
      this.draining = false
    }
  }

  // Everything above `height` is discarded rather than kept: those blocks were
  // matched against a watch set now known to be short, and the range is rescanned
  // from height + 1 once main answers.
  private holdForGap(chainName: 'receiving' | 'change', height: number): void {
    const chain = this.watchSet.gapState(chainName)
    this.gapPausedAt = height
    for (const b of this.cfilter.inflightBatches.values()) if (b.timer) clearTimeout(b.timer)
    this.blockFetcher.reset()
    this.cfilter.inflightBatches.clear()
    this.cfilterInflightHeights.clear()
    this.matchedBlocks.clear()
    this.cfilter.cursor = height + 1
    console.log(
      `[cfilter] ${chainName} gap exhausted at h=${height} ` +
      `(lastUsed=${chain.lastUsed} maxIndex=${chain.maxIndex} gapLimit=${this.watchSet.gapLimit}) — ` +
      'scan held, awaiting new addresses',
    )
    this.emit('gapExhausted', {
      walletId: this.walletId,
      height,
      isChange: chainName === 'change',
      lastUsedIndex: chain.lastUsed,
      maxIndex: chain.maxIndex,
    })
  }

  private async maybeDrainAndFinish(): Promise<void> {
    if (this.phase !== 'cfilters') return
    await this.drainMatched()
    if (this.gapPausedAt != null) return
    if (this.cfilter.cursor <= this.effectiveScanTipHeight()) return
    if (this.cfilter.inflightBatches.size > 0) return
    if (this.blockFetcher.size > 0) {
      const waiting = this.blockFetcher.heights()
      console.log(`[cfilters] scan reached tip; waiting on ${waiting.length} block(s): ${waiting.slice(0, 10).join(',')}${waiting.length > 10 ? '…' : ''}`)
      return
    }
    this.emit('cursorAdvanced', {walletId: this.walletId, height: this.effectiveScanTipHeight()})
    this.emitStatus('synced')
    console.log(`[cfilter] scan complete utxos=${this.watchSet.utxoCount} balance=${this.watchSet.totalSatoshis()} sats`)
  }

  private filterMatcher(): FilterMatcher {
    if (this.matcher == null || this.matcherRevision !== this.watchSet.revision) {
      this.matcher = new FilterMatcher(this.watchSet.items, {p: GCS_P, m: GCS_M})
      this.matcherRevision = this.watchSet.revision
    }
    return this.matcher
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

    if (this.filterMatcher().matchBlock(msg.filter ?? new Uint8Array(0), blockHashWire)) {
      console.log(`[cfilter] match h=${height} block=${wireToDisplayHex(blockHashWire).slice(0, 16)}…`)
      this.blockFetcher.request(height, blockHashWire)
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
        this.maybeDrainAndFinish().catch(err => {
          console.error('[cfilter] drain failed:', err)
          this.reportError(formatChainDbError(err), false)
        })
      }
    }
  }

  private async applyBlock(block: Block, height: number): Promise<void> {
    if (this.stopped) return
    const match = this.watchSet.applyBlock(block, height)
    if (match == null) return
    this.emit('blockApplied', {
      walletId: this.walletId,
      height,
      blockHash: block.hash(),
      blockTime: block.blockHeader.time,
      txs: match.txs,
      spends: match.spends,
    } satisfies AppliedBlock)
  }
}
