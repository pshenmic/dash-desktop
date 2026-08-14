import {BroadcastService} from './BroadcastService'
import {ChainStore} from './ChainStore'
import {GENESIS, LOCK_POOL_MAX_CONNECTIONS, LOCK_POOL_MIN_PEERS, LOCK_POOL_READY_PEERS} from './constants'
import {PoolService} from './PoolService'
import {HeaderSyncWorker} from './workers/HeaderSyncWorker'
import {CFilterSyncWorker} from './workers/CFilterSyncWorker'
import type {HeaderSyncWorkerStatus} from './types/headerSync'
import type {CFilterSyncWorkerStatus} from './types/cfilterSync'
import {P2PAddWatchAddressesMessage, P2PBroadcastMessage, P2PListenMessage, P2PReseedUtxosMessage, P2PStartMessage, P2PWatchTxsMessage} from './types/messages'
import {Network} from '../src/types'
import {BroadcastResult} from './types/broadcast'
import {AppliedBlock, GapExhausted, WalletSyncStatus, WatchAddress} from './types/walletSync'
import {Inventory, Message, Peer} from 'dash-core-p2p'
import {ChainTipState, PersistedHeader} from './types/chainStore'
import {SyncServiceEvents} from './types/sync'
import {PeerOverrides} from './types/pool'

// Top-level controller for the p2p utility process: owns ChainStore and the
// pools, spawns workers per session, aggregates their status.
//
// chain.db holds network-scoped data only. Wallet state never passes through
// it — seedUtxos + cfilterCursor arrive in the start command from SQL, and
// per-block effects flow back as blockApplied / cursorAdvanced for main to
// persist.
export class SyncService {
  private chainStore: ChainStore | null = null
  // relay:true, always up: lock watching + broadcast.
  private lockPool: PoolService | null = null
  private lockNetwork: Network | null = null
  // relay:false, p2p mode only: headers, cfilters, blocks.
  private bulkPool: PoolService | null = null
  private headerSyncWorker: HeaderSyncWorker | null = null
  private cfilterSyncWorker: CFilterSyncWorker | null = null

  private activeWalletId: string | null = null
  private activeWatchAddresses: WatchAddress[] = []
  private activeGapLimit = 0
  private activeBirthdayHeight = 1
  private activeSeedUtxos: P2PStartMessage['seedUtxos'] = []
  private activeCFilterCursor: number | null = null
  private cfilterStarted = false
  // Display order, not wire order. While non-empty the watcher fetches isdlock
  // objects to match against it.
  private watchedTxids = new Set<string>()
  // Highest ChainLock height observed — dedupes repeated clsig emits.
  private chainlockedHeight = 0

  private status: WalletSyncStatus = {
    phase: 'idle',
    network: null,
    walletId: null,
    tipHeight: 0,
    tipHash: null,
    estimatedChainHeight: 0,
    cfheadersHeight: 0,
    cfilterScanHeight: 0,
    matchedBlocksPending: 0,
    peerCount: 0,
    filterCapablePeerCount: 0,
    lockPeerCount: 0,
    phaseEtaMs: null,
    lastError: null,
    updatedAt: Date.now(),
  }

  private phaseStart: {phase: WalletSyncStatus['phase']; startedAt: number; startHeight: number} | null = null

  constructor(private readonly events: SyncServiceEvents) {}

  getStatus = (): WalletSyncStatus => this.status

  // LevelDB is single-owner, so two near-simultaneous starts would race to open
  // chain.db and the loser fails the lock as LEVEL_DATABASE_NOT_OPEN.
  private opChain: Promise<unknown> = Promise.resolve()

  private runExclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = this.opChain.then(fn, fn)
    this.opChain = run.then(() => undefined, () => undefined)
    return run
  }

  start = (cmd: P2PStartMessage): Promise<void> => this.runExclusive(() => this.startInner(cmd))

  stop = (): Promise<void> => this.runExclusive(() => this.stopInner())

  // `start` is a superset, so listening first and syncing later grows the
  // session rather than restarting it.
  listen = (cmd: P2PListenMessage): Promise<void> =>
    this.runExclusive(async () => this.startLockCore(cmd.network, cmd.peerOverrides))

  // Everything that touches neither chain.db nor the sync workers, so it runs
  // in rpc mode and survives the bulk layer stopping — pending lock waiters
  // outlive a mode switch. Network-scoped rather than wallet-scoped so
  // switching wallets reuses a filled pool instead of re-crawling DNS.
  private startLockCore = (network: Network, overrides?: PeerOverrides): void => {
    if (this.lockPool && this.lockNetwork === network) return

    this.teardownLock()
    this.lockNetwork = network
    this.watchedTxids = new Set()
    this.chainlockedHeight = 0

    this.lockPool = new PoolService(network, {
      label: 'lock-pool',
      relay: true,
      readyPeers: LOCK_POOL_READY_PEERS,
      minPeers: LOCK_POOL_MIN_PEERS,
      maxConnections: LOCK_POOL_MAX_CONNECTIONS,
      dnsSeeds: overrides?.dnsSeeds,
      peers: overrides?.peers,
    })
    this.lockPool.on('peerinv', this.onPeerInvForLocks)
    this.lockPool.on('peerisdlock', this.onIsdlock)
    this.lockPool.on('peerclsig', this.onClsig)
    this.lockPool.on('peeraddr', this.feedBulkPool)
    // Nothing else emits status while the bulk layer is down, so lock-pool
    // churn is a lazy-mode wallet's only signal.
    this.lockPool.on('peerready', this.onLockPeerChange)
    this.lockPool.on('peerdisconnect', this.onLockPeerChange)
    this.lockPool.start()
  }

  private onLockPeerChange = (): void => {
    this.emit({})
    this.feedBulkPool()
  }

  // The bulk pool has no DNS seed, so this is its only supply. Driven off peer
  // events as well as `peeraddr` because at creation the lock pool's book is
  // still just DNS entries — waiting for gossip alone would leave it empty.
  private feedBulkPool = (): void => {
    if (!this.bulkPool || !this.lockPool) return
    if (this.bulkPool.network !== this.lockPool.network) return
    this.bulkPool.addAddresses(this.lockPool.takeAddresses())
  }

  private startInner = async (cmd: P2PStartMessage): Promise<void> => {
    // Duplicate start (StrictMode double-invoke, overlapping auto-start).
    // Ignoring beats tearing down and re-opening chain.db.
    if (this.chainStore && this.activeWalletId === cmd.walletId) return

    await this.teardownBulk()
    this.startLockCore(cmd.network, cmd.peerOverrides)

    this.activeWalletId = cmd.walletId
    this.activeWatchAddresses = cmd.watchAddresses ?? []
    this.activeGapLimit = cmd.gapLimit
    this.activeBirthdayHeight = cmd.birthdayHeight && cmd.birthdayHeight > 0 ? cmd.birthdayHeight : 1
    this.activeSeedUtxos = cmd.seedUtxos ?? []
    this.activeCFilterCursor = cmd.cfilterCursor ?? null
    this.cfilterStarted = false

    this.emit({
      phase: 'connecting',
      network: cmd.network,
      walletId: cmd.walletId,
      tipHeight: 0,
      tipHash: null,
      estimatedChainHeight: 0,
      cfheadersHeight: 0,
      cfilterScanHeight: this.activeCFilterCursor ?? 0,
      matchedBlocksPending: 0,
      peerCount: 0,
      filterCapablePeerCount: 0,
      lockPeerCount: 0,
      phaseEtaMs: null,
      lastError: null,
    })

    // Single-owner LevelDB lock.
    this.chainStore = new ChainStore(cmd.chainDbPath, cmd.network)
    let persisted: ChainTipState
    try {
      persisted = await this.openWithRetry(this.chainStore)
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'unknown'
      const labelled = `chain.db unusable (${code}): ${describeError(err)}. Call resetWalletSync to recover.`
      await this.chainStore.close().catch(() => { /* ignore */ })
      this.chainStore = null
      this.emit({phase: 'stopped', lastError: labelled})
      this.events.error(labelled)
      return
    }

    // Resume from persisted tip, or genesis on a fresh chain.db.
    let resumeHeight = persisted.tipHeight
    let resumeHash = persisted.tipHash
    console.log(`[p2p] persisted state: height=${resumeHeight} hash=${resumeHash ?? 'null'}`)
    if (!resumeHash) {
      resumeHash = GENESIS[cmd.network].hash
      resumeHeight = GENESIS[cmd.network].height
      console.log(`[p2p] genesis fallback: height=${resumeHeight} hash=${resumeHash}`)
    }
    console.log(`[p2p] starting sync from height=${resumeHeight} hash=${resumeHash} watchAddresses=${this.activeWatchAddresses.length} birthday=${this.activeBirthdayHeight} seedUtxos=${this.activeSeedUtxos.length} cursor=${this.activeCFilterCursor ?? 'null'}`)

    // `relay: false` drops the tx inv stream these workers never read — and
    // Dash Core gates ISLOCK/ISDLOCK inv behind the same flag, which is why
    // lock watching stays on the other pool.
    this.bulkPool = new PoolService(cmd.network, {
      label: 'bulk-pool',
      relay: false,
      dnsSeed: false,
      peers: cmd.peerOverrides?.peers,
    })
    this.feedBulkPool()
    this.bulkPool.start()

    // CFilterSyncWorker boots lazily once header sync reports 'synced', so the
    // two never compete for chain.db state mid-sync.
    this.headerSyncWorker = new HeaderSyncWorker({
      chainStore: this.chainStore,
      peerPool: this.bulkPool,
      initialTipHeight: resumeHeight,
      initialTipHash: resumeHash,
      finalityHeight: this.chainlockedHeight,
    })
    this.headerSyncWorker.on('status', (s: HeaderSyncWorkerStatus) => this.onHeaderStatus(s))
    this.headerSyncWorker.on('chainExtended', (headers: PersistedHeader[]) => {
      this.cfilterSyncWorker?.onChainExtended(headers)
    })
    this.headerSyncWorker.on('chainRewound', (height: number) => {
      this.cfilterSyncWorker?.onChainRewound(height)
      // The worker takes its cursor from the start command, not from SQL, so a
      // rewind before it boots has to come down with it.
      if (this.cfilterSyncWorker == null && this.activeCFilterCursor != null) {
        this.activeCFilterCursor = Math.min(this.activeCFilterCursor, height)
      }
      if (this.activeWalletId) this.events.chainRewound(this.activeWalletId, height)
    })
    this.headerSyncWorker.on('error', err =>
      this.handleWorkerError('HeaderSyncWorker', err.message)
    )
    await this.headerSyncWorker.start()
  }

  private stopInner = async (): Promise<void> => {
    await this.teardownBulk()
    this.activeWalletId = null
    this.activeWatchAddresses = []
    this.activeGapLimit = 0
    this.activeBirthdayHeight = 1
    this.activeSeedUtxos = []
    this.activeCFilterCursor = null
    this.emit({
      phase: 'stopped',
      network: null,
      walletId: null,
      tipHeight: 0,
      tipHash: null,
      estimatedChainHeight: 0,
      cfheadersHeight: 0,
      cfilterScanHeight: 0,
      matchedBlocksPending: 0,
      peerCount: 0,
      filterCapablePeerCount: 0,
      lockPeerCount: 0,
      phaseEtaMs: null,
    })
  }

  // Retries because the common failure is a prior session's utility process
  // still releasing the LevelDB lock; a short backoff beats forcing a
  // resetWalletSync.
  private async openWithRetry(store: ChainStore): Promise<ChainTipState> {
    const ATTEMPTS = 5
    const BACKOFF_MS = 400
    let lastErr: unknown
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        await store.open()
        return await store.initSyncState()
      } catch (err) {
        lastErr = err
        await store.close().catch(() => { /* ignore */ })
        if (attempt < ATTEMPTS) {
          console.warn(`[p2p] chain.db open attempt ${attempt}/${ATTEMPTS} failed, retrying: ${describeError(err)}`)
          await delay(BACKOFF_MS)
        }
      }
    }
    throw lastErr
  }

  broadcast = (cmd: P2PBroadcastMessage): void => {
    const emptyResult: BroadcastResult = {
      txid: '',
      peersInvited: 0,
      peersAcked: [],
      peersDelivered: [],
      peersPropagated: [],
      instantLocked: false,
      islockHex: null,
      lockLatencyMs: null,
      waitedForLock: false,
      rejections: [],
      durationMs: 0,
    }
    if (!this.lockPool) {
      this.events.broadcastResult(cmd.requestId, false, emptyResult, 'broadcast: peer pool not started')
      return
    }
    // The lock pool, so the isdlock for this tx arrives on the connections we
    // announced it to.
    const service = new BroadcastService(this.lockPool)
    service.broadcast(cmd.txHex, cmd.policy).then(result => {
      this.events.broadcastResult(cmd.requestId, true, result, null)
    }).catch(err => {
      const message = err instanceof Error ? err.message : String(err)
      const result = (err as {result?: BroadcastResult}).result ?? emptyResult
      this.events.broadcastResult(cmd.requestId, false, result, message)
    })
  }

  addWatchAddresses = (cmd: P2PAddWatchAddressesMessage): void => {
    if (!this.activeWalletId || cmd.walletId !== this.activeWalletId) return
    const merged = new Map(this.activeWatchAddresses.map(a => [a.address, a]))
    for (const a of cmd.addresses) merged.set(a.address, a)
    this.activeWatchAddresses = [...merged.values()]
    this.cfilterSyncWorker?.addWatchAddresses(cmd.addresses, cmd.rewindToHeight)
  }

  reseedUtxos = (cmd: P2PReseedUtxosMessage): void => {
    if (cmd.walletId !== this.activeWalletId) return
    this.activeSeedUtxos = cmd.utxos
    this.cfilterSyncWorker?.reseedUtxos(cmd.utxos)
  }

  watchTxs = (cmd: P2PWatchTxsMessage): void => {
    if (cmd.mode === 'replace') {
      this.watchedTxids = new Set(cmd.txids)
    } else {
      for (const txid of cmd.txids) this.watchedTxids.add(txid)
    }
    console.log(`[locks] watchTxs ${cmd.mode} (${this.watchedTxids.size}): ${[...this.watchedTxids].join(',') || '(none)'}`)
  }

  // ── lock watcher ────────────────────────────────────────────────────────────

  // An inv carries only the object's hash, so matching by txid means issuing a
  // getdata to read its contents.
  private onPeerInvForLocks = (
    peer: Peer,
    msg: Message & {inventory?: Array<{type: number; hash: Uint8Array}>},
  ): void => {
    if (!this.lockPool) return
    // With no waiter and no sync layer to mark txs final, fetching one per
    // block is permanent background cost for nothing.
    const wantChainlocks = this.watchedTxids.size > 0 || this.bulkPool != null
    const wanted: Array<{type: number; hash: Uint8Array}> = []
    for (const item of msg.inventory ?? []) {
      if (item.type === Inventory.TYPE.CLSIG) {
        if (wantChainlocks) wanted.push({type: item.type, hash: item.hash})
      } else if (item.type === Inventory.TYPE.ISDLOCK) {
        const hashHex = Buffer.from(item.hash).reverse().toString('hex')
        if (this.watchedTxids.size > 0) {
          console.log(`[locks] isdlock inv ${hashHex} — requesting getdata (watching ${this.watchedTxids.size})`)
          wanted.push({type: item.type, hash: item.hash})
        } else {
          console.log(`[locks] isdlock inv ${hashHex} — skipped, watch set empty`)
        }
      }
    }
    if (wanted.length === 0) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    peer.sendMessage((this.lockPool.messages as any).GetData(wanted))
  }

  // isdlock.txid is wire/internal byte order; our watch set is display order.
  private onIsdlock = (_peer: Peer, msg: Message & {txid?: string}): void => {
    if (!msg.txid) {
      console.log('[locks] isdlock received without a txid')
      return
    }
    const displayTxid = reverseHex(msg.txid)
    const matched = this.watchedTxids.has(displayTxid)
    console.log(`[locks] isdlock received wire=${msg.txid} display=${displayTxid} matched=${matched} watching=[${[...this.watchedTxids].join(',')}]`)
    if (!matched) return
    this.watchedTxids.delete(displayTxid)
    // Serialized for InstantAssetLockProof construction in main. We broadcast
    // L1 over this pool, so this is where the isdlock actually arrives — DAPI's
    // subscribeToTransactions never delivers it.
    const islockHex = Buffer.from((msg as unknown as {getPayload(): Uint8Array}).getPayload()).toString('hex')
    this.events.txInstantLocked(displayTxid, islockHex)
  }

  private onClsig = (_peer: Peer, msg: Message & {height?: number}): void => {
    if (!this.lockNetwork) return
    const height = msg.height ?? 0
    if (height <= this.chainlockedHeight) return
    this.chainlockedHeight = height
    // Header sync will not rewind below this. Logged because a floor stuck at 0
    // leaves REORG_MAX_DEPTH as the only bound on a rewind.
    this.headerSyncWorker?.setFinalityHeight(height)
    console.log(`[locks] chainlock h=${height} — reorg floor ${this.headerSyncWorker ? 'applied' : 'not applied (no header sync)'}`)
    this.events.chainLocked(this.lockNetwork, height)
  }

  // ── private ───────────────────────────────────────────────────────────────

  private async teardownBulk(): Promise<void> {
    if (this.cfilterSyncWorker) {
      this.cfilterSyncWorker.stop()
      this.cfilterSyncWorker.removeAllListeners()
      this.cfilterSyncWorker = null
    }
    if (this.headerSyncWorker) {
      this.headerSyncWorker.stop()
      this.headerSyncWorker.removeAllListeners()
      this.headerSyncWorker = null
    }
    if (this.bulkPool) {
      this.bulkPool.stop()
      this.bulkPool.removeAllListeners()
      this.bulkPool = null
    }
    if (this.chainStore) {
      await this.chainStore.close().catch(() => { /* ignore */ })
      this.chainStore = null
    }
    this.cfilterStarted = false
  }

  private teardownLock(): void {
    this.lockNetwork = null
    if (!this.lockPool) return
    this.lockPool.stop()
    this.lockPool.removeAllListeners()
    this.lockPool = null
  }

  private emit(next: Partial<WalletSyncStatus>): void {
    const merged = {...this.status, ...next, updatedAt: Date.now()}
    // Owned here rather than by the workers: the lock pool outlives them.
    merged.lockPeerCount = this.lockPool?.readyPeers.size ?? 0
    merged.phaseEtaMs = this.computePhaseEta(merged)
    this.status = merged
    this.events.status(this.status)
  }

  // Extrapolates from height progress since the phase started. null for phases
  // with no height target, and until there is a usable rate sample.
  private computePhaseEta(status: WalletSyncStatus): number | null {
    const target = phaseTargetHeight(status)
    const current = phaseCurrentHeight(status)
    if (target == null || current == null) {
      this.phaseStart = null
      return null
    }

    const now = status.updatedAt
    if (!this.phaseStart || this.phaseStart.phase !== status.phase) {
      this.phaseStart = {phase: status.phase, startedAt: now, startHeight: current}
      return null
    }

    const elapsed = now - this.phaseStart.startedAt
    const delta = current - this.phaseStart.startHeight
    const remaining = target - current
    if (elapsed < 1000 || delta <= 0 || remaining <= 0) return null

    return Math.round((remaining * elapsed) / delta)
  }

  private onHeaderStatus(s: HeaderSyncWorkerStatus): void {
    this.emit({
      // Once cfilter takes over, leave its phase alone — header tip-follow
      // updates only push tipHeight, not phase.
      phase: this.cfilterStarted
        ? this.status.phase
        : s.phase === 'syncing-headers' || s.phase === 'connecting' || s.phase === 'stopped'
          ? s.phase
          : 'synced-headers',
      tipHeight: s.tipHeight,
      tipHash: s.tipHash,
      estimatedChainHeight: s.estimatedChainHeight,
      peerCount: s.peerCount,
    })

    if (s.phase === 'synced' && !this.cfilterStarted && this.chainStore && this.bulkPool && s.tipHash) {
      this.cfilterStarted = true
      this.startCFilterWorker(s.tipHeight, s.tipHash).catch(err =>
        this.handleWorkerError('CFilterSyncWorker', err instanceof Error ? err.message : String(err))
      )
    }
  }

  private async startCFilterWorker(tipHeight: number, tipHashDisplayHex: string): Promise<void> {
    if (!this.chainStore || !this.bulkPool || !this.activeWalletId) return
    this.cfilterSyncWorker = new CFilterSyncWorker({
      network: this.chainStore.network,
      walletId: this.activeWalletId,
      chainStore: this.chainStore,
      peerPool: this.bulkPool,
      chainTipHeight: tipHeight,
      chainTipHashDisplayHex: tipHashDisplayHex,
      watchAddresses: this.activeWatchAddresses,
      gapLimit: this.activeGapLimit,
      birthdayHeight: this.activeBirthdayHeight,
      seedUtxos: this.activeSeedUtxos,
      cfilterCursor: this.activeCFilterCursor,
    })
    this.cfilterSyncWorker.on('status', (s: CFilterSyncWorkerStatus) => this.onCFilterStatus(s))
    this.cfilterSyncWorker.on('blockApplied', (block: AppliedBlock) => this.events.blockApplied(block))
    this.cfilterSyncWorker.on('cursorAdvanced', (msg: {walletId: string; height: number}) =>
      this.events.cursorAdvanced(msg.walletId, msg.height)
    )
    this.cfilterSyncWorker.on('cursorReset', (msg: {walletId: string; height: number}) =>
      this.events.cursorReset(msg.walletId, msg.height)
    )
    this.cfilterSyncWorker.on('gapExhausted', (gap: GapExhausted) => this.events.gapExhausted(gap))
    this.cfilterSyncWorker.on('error', err =>
      this.handleWorkerError('CFilterSyncWorker', err.message)
    )
    await this.cfilterSyncWorker.start()
  }

  private onCFilterStatus(s: CFilterSyncWorkerStatus): void {
    const phase: WalletSyncStatus['phase'] =
      s.phase === 'connecting' ? 'syncing-cfcheckpt'
      : s.phase === 'cfcheckpt' ? 'syncing-cfcheckpt'
      : s.phase === 'cfheaders' ? 'syncing-cfheaders'
      : s.phase === 'cfilters' ? 'syncing-cfilters'
      : s.phase === 'synced' ? 'synced'
      : s.phase === 'stopped' ? 'stopped'
      : this.status.phase
    this.emit({
      phase,
      cfheadersHeight: s.cfheadersHeight,
      cfilterScanHeight: s.cfilterScanHeight,
      matchedBlocksPending: s.matchedBlocksPending,
      peerCount: Math.max(this.status.peerCount, s.peerCount),
      filterCapablePeerCount: s.filterCapablePeerCount,
    })
  }

  private handleWorkerError(workerName: string, message: string): void {
    const fatal = isFatalChainDbError(message)
    const err = fatal
      ? `[${workerName}] chain.db unusable: ${message}. Call resetWalletSync to recover.`
      : `[${workerName}] ${message}`
    console.error(err)
    this.status = {...this.status, lastError: err, updatedAt: Date.now()}
    this.events.status(this.status)
    this.events.error(err)
    if (fatal) {
      // Bulk layer only — a header/cfilter failure says nothing about the lock
      // pool, and dropping it would strand anything waiting on an isdlock.
      this.teardownBulk()
        .catch(() => { /* ignore */ })
        .finally(() => this.emit({phase: 'stopped'}))
    }
  }
}

// abstract-level reports every failed open as LEVEL_DATABASE_NOT_OPEN and
// buries the real reason (held lock, IO error) in `cause`. Unwrap it so logs
// name the actual problem.
function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const cause = (err as { cause?: unknown })?.cause
  const causeMsg = cause instanceof Error ? cause.message : cause != null ? String(cause) : null
  return causeMsg ? `${message} (cause: ${causeMsg})` : message
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Reverse a hex string byte-wise (wire/internal txid order ⇄ display order).
function reverseHex(hex: string): string {
  let out = ''
  for (let i = hex.length - 2; i >= 0; i -= 2) out += hex.slice(i, i + 2)
  return out
}

// chain.db is unusable past this point (corruption, IO error, folder unlinked
// mid-sync) — workers cannot safely keep running and main must resetSync.
function isFatalChainDbError(message: string): boolean {
  return /LEVEL_(CORRUPTION|IO_ERROR|DATABASE_NOT_OPEN|NOT_FOUND)|ENOENT|EBADF/i.test(message)
}

function phaseCurrentHeight(s: WalletSyncStatus): number | null {
  switch (s.phase) {
    case 'syncing-headers': return s.tipHeight
    case 'syncing-cfheaders': return s.cfheadersHeight
    case 'syncing-cfilters': return s.cfilterScanHeight
    default: return null
  }
}

function phaseTargetHeight(s: WalletSyncStatus): number | null {
  switch (s.phase) {
    case 'syncing-headers': return s.estimatedChainHeight > 0 ? s.estimatedChainHeight : null
    case 'syncing-cfheaders': return s.tipHeight > 0 ? s.tipHeight : null
    case 'syncing-cfilters': return s.tipHeight > 0 ? s.tipHeight : null
    default: return null
  }
}