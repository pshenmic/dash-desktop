import {ChainStore, PersistedHeader} from './ChainStore'
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
import {P2PAddWatchAddressesMessage, P2PStartMessage} from './types/messages'
import {AppliedBlock, WalletSyncStatus} from './types/walletSync'

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

  start = async (cmd: P2PStartMessage): Promise<void> => {
    await this.teardown()

    this.activeWalletId = cmd.walletId
    this.activeWatchAddresses = cmd.watchAddresses ?? []
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
      phaseEtaMs: null,
      lastError: null,
    })

    // Open chain.db (single-owner LevelDB lock). Chain.db now holds only
    // network-scoped data (headers, hash cache, filter headers).
    this.chainStore = new ChainStore(cmd.chainDbPath, cmd.network)
    let persisted
    try {
      await this.chainStore.open()
      persisted = await this.chainStore.initSyncState()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string }).code ?? 'unknown'
      const labelled = `chain.db unusable (${code}): ${message}. Call resetWalletSync to recover.`
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

  stop = async (): Promise<void> => {
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

  addWatchAddresses = (cmd: P2PAddWatchAddressesMessage): void => {
    if (!this.activeWalletId || cmd.walletId !== this.activeWalletId) return
    const merged = new Set(this.activeWatchAddresses)
    for (const a of cmd.addresses) merged.add(a)
    this.activeWatchAddresses = [...merged]
    this.cfilterSyncWorker?.addWatchAddresses(cmd.addresses, cmd.rewindToHeight)
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