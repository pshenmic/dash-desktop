import {BroadcastService} from './BroadcastService'
import {ChainStore, ChainTipState, PersistedHeader} from './ChainStore'
import {GENESIS} from './constants'
import {PoolService} from './PoolService'
import {
  HeaderSyncWorker,
  HeaderSyncWorkerStatus,
} from './workers/HeaderSyncWorker'
import {
  CFilterSyncWorker,
  CFilterSyncWorkerStatus,
} from './workers/CFilterSyncWorker'
import {P2PAddWatchAddressesMessage, P2PBroadcastMessage, P2PStartMessage, P2PWatchTxsMessage} from './types/messages'
import {BroadcastResult} from './types/broadcast'
import {AppliedBlock, WalletSyncStatus} from './types/walletSync'
import {Inventory, Message, Peer} from 'dash-core-p2p'

// Top-level controller for the p2p utility process. Owns the shared
// infrastructure (ChainStore + PoolService), spawns workers per session,
// and aggregates per-worker status updates into the wire WalletSyncStatus.
//
// Workers are pure: they don't talk to parentPort, they don't hold a Pool,
// they don't open chain.db. SyncService wires them to the shared
// dependencies and forwards their events.
//
// Wallet-scoped state (UTXOs, transactions, cfilter cursor) does NOT pass
// through chain.db or ChainStore — the start command carries seedUtxos +
// cfilterCursor from main (sourced from SQL), and per-block effects flow
// back as blockApplied / cursorAdvanced events for main to persist.
export interface SyncServiceEvents {
  status: (status: WalletSyncStatus) => void
  blockApplied: (block: AppliedBlock) => void
  cursorAdvanced: (walletId: string, height: number) => void
  error: (message: string) => void
  broadcastResult: (
    requestId: string,
    ok: boolean,
    result: BroadcastResult,
    errorMessage: string | null,
  ) => void
  txInstantLocked: (walletId: string, txid: string, islockHex: string) => void
  chainLocked: (walletId: string, height: number) => void
}

export class SyncService {
  private chainStore: ChainStore | null = null
  private peerPool: PoolService | null = null
  private headerSyncWorker: HeaderSyncWorker | null = null
  private cfilterSyncWorker: CFilterSyncWorker | null = null

  private activeWalletId: string | null = null
  private activeWatchAddresses: string[] = []
  private activeBirthdayHeight = 1
  private activeSeedUtxos: P2PStartMessage['seedUtxos'] = []
  private activeCFilterCursor: number | null = null
  private cfilterStarted = false
  // Display-order txids of unconfirmed local txs to watch for an isdlock.
  // While non-empty the watcher fetches isdlock objects to match them.
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
    phaseEtaMs: null,
    lastError: null,
    updatedAt: Date.now(),
  }

  private phaseStart: {phase: WalletSyncStatus['phase']; startedAt: number; startHeight: number} | null = null

  constructor(private readonly events: SyncServiceEvents) {}

  getStatus = (): WalletSyncStatus => this.status

  // Serialize lifecycle ops so two near-simultaneous start commands can't both
  // open chain.db — LevelDB is single-owner and a second concurrent open fails
  // the lock (surfacing as LEVEL_DATABASE_NOT_OPEN).
  private opChain: Promise<unknown> = Promise.resolve()

  private runExclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = this.opChain.then(fn, fn)
    this.opChain = run.then(() => undefined, () => undefined)
    return run
  }

  start = (cmd: P2PStartMessage): Promise<void> => this.runExclusive(() => this.startInner(cmd))

  stop = (): Promise<void> => this.runExclusive(() => this.stopInner())

  private startInner = async (cmd: P2PStartMessage): Promise<void> => {
    // Already syncing this wallet — a duplicate start (StrictMode double-invoke,
    // overlapping auto-start). Ignore rather than tear down and re-open chain.db.
    if (this.chainStore && this.activeWalletId === cmd.walletId) return

    await this.teardown()

    this.activeWalletId = cmd.walletId
    this.activeWatchAddresses = cmd.watchAddresses ?? []
    this.activeBirthdayHeight = cmd.birthdayHeight && cmd.birthdayHeight > 0 ? cmd.birthdayHeight : 1
    this.activeSeedUtxos = cmd.seedUtxos ?? []
    this.activeCFilterCursor = cmd.cfilterCursor ?? null
    this.cfilterStarted = false
    this.watchedTxids = new Set()
    this.chainlockedHeight = 0

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
      phaseEtaMs: null,
      lastError: null,
    })

    // Open chain.db (single-owner LevelDB lock). Chain.db now holds only
    // network-scoped data (headers, hash cache, filter headers).
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

    // Boot shared peer pool.
    this.peerPool = new PoolService(cmd.network)
    this.peerPool.start()

    // Lock watcher: fetch + match InstantSend (isdlock) / ChainLock (clsig)
    // objects so locally-broadcast txs can be finalized fast.
    this.peerPool.on('peerinv', this.onPeerInvForLocks)
    this.peerPool.on('peerisdlock', this.onIsdlock)
    this.peerPool.on('peerclsig', this.onClsig)

    // Boot HeaderSyncWorker. CFilterSyncWorker is booted lazily once header
    // sync emits 'synced' status (so we don't compete for chain.db state
    // mid-sync).
    this.headerSyncWorker = new HeaderSyncWorker({
      chainStore: this.chainStore,
      peerPool: this.peerPool,
      initialTipHeight: resumeHeight,
      initialTipHash: resumeHash,
    })
    this.headerSyncWorker.on('status', (s: HeaderSyncWorkerStatus) => this.onHeaderStatus(s))
    this.headerSyncWorker.on('chainExtended', (headers: PersistedHeader[]) => {
      this.cfilterSyncWorker?.onChainExtended(headers)
    })
    this.headerSyncWorker.on('error', err =>
      this.handleWorkerError('HeaderSyncWorker', err.message)
    )
    this.headerSyncWorker.start()
  }

  private stopInner = async (): Promise<void> => {
    await this.teardown()
    this.activeWalletId = null
    this.activeWatchAddresses = []
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
      phaseEtaMs: null,
    })
  }

  // Open chain.db, retrying a few times on failure. The common transient is a
  // still-held LevelDB lock (a prior session's utility process releasing it);
  // a short backoff recovers automatically instead of forcing a resetWalletSync.
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
      peersPropagated: [],
      instantLocked: false,
      rejections: [],
      durationMs: 0,
    }
    if (!this.peerPool) {
      this.events.broadcastResult(cmd.requestId, false, emptyResult, 'broadcast: peer pool not started — call startSync first')
      return
    }
    const service = new BroadcastService(this.peerPool)
    service.broadcast(cmd.txHex).then(result => {
      this.events.broadcastResult(cmd.requestId, true, result, null)
    }).catch(err => {
      const message = err instanceof Error ? err.message : String(err)
      const result = (err as {result?: BroadcastResult}).result ?? emptyResult
      this.events.broadcastResult(cmd.requestId, false, result, message)
    })
  }

  addWatchAddresses = (cmd: P2PAddWatchAddressesMessage): void => {
    if (!this.activeWalletId || cmd.walletId !== this.activeWalletId) return
    const merged = new Set(this.activeWatchAddresses)
    for (const a of cmd.addresses) merged.add(a)
    this.activeWatchAddresses = [...merged]
    this.cfilterSyncWorker?.addWatchAddresses(cmd.addresses, cmd.rewindToHeight)
  }

  watchTxs = (cmd: P2PWatchTxsMessage): void => {
    if (!this.activeWalletId || cmd.walletId !== this.activeWalletId) return
    this.watchedTxids = new Set(cmd.txids)
    console.log(`[locks] watchTxs set (${this.watchedTxids.size}): ${[...this.watchedTxids].join(',') || '(none)'}`)
  }

  // ── lock watcher ────────────────────────────────────────────────────────────

  // On every inv, fetch ChainLock objects (cheap, ~1/block) and — only while
  // we have local txs awaiting confirmation — InstantSend objects, so we can
  // match them by txid. The inv carries only the object's hash, so we must
  // getdata it to read its contents.
  private onPeerInvForLocks = (
    peer: Peer,
    msg: Message & {inventory?: Array<{type: number; hash: Uint8Array}>},
  ): void => {
    if (!this.peerPool) return
    const wanted: Array<{type: number; hash: Uint8Array}> = []
    for (const item of msg.inventory ?? []) {
      if (item.type === Inventory.TYPE.CLSIG) {
        wanted.push({type: item.type, hash: item.hash})
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
    peer.sendMessage((this.peerPool.messages as any).GetData(wanted))
  }

  // isdlock.txid is wire/internal byte order; our watch set is display order.
  private onIsdlock = (_peer: Peer, msg: Message & {txid?: string}): void => {
    if (!this.activeWalletId || !msg.txid) {
      console.log(`[locks] isdlock received but no txid/wallet (txid=${msg.txid ?? 'undefined'})`)
      return
    }
    const displayTxid = reverseHex(msg.txid)
    const matched = this.watchedTxids.has(displayTxid)
    console.log(`[locks] isdlock received wire=${msg.txid} display=${displayTxid} matched=${matched} watching=[${[...this.watchedTxids].join(',')}]`)
    if (!matched) return
    this.watchedTxids.delete(displayTxid)
    // Serialize the lock so the main process can build an InstantAssetLockProof
    // from it — we broadcast L1 txs over this pool, so this is where the isdlock
    // actually arrives (DAPI's subscribeToTransactions does not deliver it).
    const islockHex = Buffer.from((msg as unknown as {getPayload(): Uint8Array}).getPayload()).toString('hex')
    this.events.txInstantLocked(this.activeWalletId, displayTxid, islockHex)
  }

  private onClsig = (_peer: Peer, msg: Message & {height?: number}): void => {
    if (!this.activeWalletId) return
    const height = msg.height ?? 0
    if (height <= this.chainlockedHeight) return
    this.chainlockedHeight = height
    this.events.chainLocked(this.activeWalletId, height)
  }

  // ── private ───────────────────────────────────────────────────────────────

  private async teardown(): Promise<void> {
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
    if (this.peerPool) {
      this.peerPool.stop()
      this.peerPool.removeAllListeners()
      this.peerPool = null
    }
    if (this.chainStore) {
      await this.chainStore.close().catch(() => { /* ignore */ })
      this.chainStore = null
    }
    this.cfilterStarted = false
  }

  private emit(next: Partial<WalletSyncStatus>): void {
    const merged = {...this.status, ...next, updatedAt: Date.now()}
    merged.phaseEtaMs = this.computePhaseEta(merged)
    this.status = merged
    this.events.status(this.status)
  }

  // Returns ms remaining for the active phase, based on the rate of height
  // progress since the phase started. null for phases with no height target
  // (idle, connecting, synced-headers, synced, stopped) and while we don't
  // yet have a usable rate sample.
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

    if (s.phase === 'synced' && !this.cfilterStarted && this.chainStore && this.peerPool && s.tipHash) {
      this.cfilterStarted = true
      this.startCFilterWorker(s.tipHeight, s.tipHash).catch(err =>
        this.handleWorkerError('CFilterSyncWorker', err instanceof Error ? err.message : String(err))
      )
    }
  }

  private async startCFilterWorker(tipHeight: number, tipHashDisplayHex: string): Promise<void> {
    if (!this.chainStore || !this.peerPool || !this.activeWalletId) return
    this.cfilterSyncWorker = new CFilterSyncWorker({
      network: this.chainStore.network,
      walletId: this.activeWalletId,
      chainStore: this.chainStore,
      peerPool: this.peerPool,
      chainTipHeight: tipHeight,
      chainTipHashDisplayHex: tipHashDisplayHex,
      watchAddresses: this.activeWatchAddresses,
      birthdayHeight: this.activeBirthdayHeight,
      seedUtxos: this.activeSeedUtxos,
      cfilterCursor: this.activeCFilterCursor,
    })
    this.cfilterSyncWorker.on('status', (s: CFilterSyncWorkerStatus) => this.onCFilterStatus(s))
    this.cfilterSyncWorker.on('blockApplied', (block: AppliedBlock) => this.events.blockApplied(block))
    this.cfilterSyncWorker.on('cursorAdvanced', (msg: {walletId: string; height: number}) =>
      this.events.cursorAdvanced(msg.walletId, msg.height)
    )
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
      this.teardown()
        .catch(() => { /* ignore */ })
        .finally(() => this.emit({phase: 'stopped'}))
    }
  }
}

// abstract-level wraps a failed open as LEVEL_DATABASE_NOT_OPEN ("Database
// failed to open") and hides the real reason (held lock, IO error) in `cause`.
// Surface it so logs name the actual problem instead of the generic wrapper.
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

// Errors that mean chain.db is no longer usable — corruption, IO errors,
// or the folder being unlinked under us mid-sync. Once we hit one, we can't
// safely keep workers running; main process must resetSync to recover.
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