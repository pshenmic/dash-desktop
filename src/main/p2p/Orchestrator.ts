import {ChainDAO, PersistedHeader} from './ChainDAO'
import {ChainStore} from './ChainStore'
import {GENESIS_HASH} from './genesis'
import {PeerPool} from './PeerPool'
import {
  HeaderSyncWorker,
  HeaderSyncWorkerStatus,
} from './workers/HeaderSyncWorker'
import {
  CFilterSyncWorker,
  CFilterSyncWorkerStatus,
} from './workers/CFilterSyncWorker'
import {
  P2PAddWatchAddressesMessage,
  P2PStartMessage,
  WalletSyncStatus,
  WalletSyncUtxo,
} from './messages'

// Top-level controller for the p2p utility process. Owns the shared
// infrastructure (ChainStore + PeerPool), spawns workers per session, and
// aggregates per-worker status updates into the wire WalletSyncStatus.
//
// Workers are pure: they don't talk to parentPort, they don't hold a Pool,
// they don't open chain.db. The Orchestrator wires them to the shared
// services and forwards their events.
export interface OrchestratorEvents {
  status: (status: WalletSyncStatus) => void
  utxos: (utxos: WalletSyncUtxo[]) => void
  error: (message: string) => void
}

export class Orchestrator {
  private chainDAO: ChainDAO | null = null
  private chainStore: ChainStore | null = null
  private peerPool: PeerPool | null = null
  private headerSyncWorker: HeaderSyncWorker | null = null
  private cfilterSyncWorker: CFilterSyncWorker | null = null

  private activeWalletId: string | null = null
  private activeWatchAddresses: string[] = []
  private activeBirthdayHeight = 1
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
    utxoCount: 0,
    totalBalance: '0',
    peerCount: 0,
    filterCapablePeerCount: 0,
    lastError: null,
    updatedAt: Date.now(),
  }

  constructor(private readonly events: OrchestratorEvents) {}

  getStatus = (): WalletSyncStatus => this.status

  start = async (cmd: P2PStartMessage): Promise<void> => {
    await this.teardown()

    this.activeWalletId = cmd.walletId
    this.activeWatchAddresses = cmd.watchAddresses ?? []
    this.activeBirthdayHeight = cmd.birthdayHeight && cmd.birthdayHeight > 0 ? cmd.birthdayHeight : 1
    this.cfilterStarted = false

    this.emit({
      phase: 'connecting',
      network: cmd.network,
      walletId: cmd.walletId,
      tipHeight: 0,
      tipHash: null,
      estimatedChainHeight: 0,
      cfheadersHeight: 0,
      cfilterScanHeight: 0,
      matchedBlocksPending: 0,
      utxoCount: 0,
      totalBalance: '0',
      peerCount: 0,
      filterCapablePeerCount: 0,
      lastError: null,
    })

    // Open chain.db (single-owner LevelDB lock).
    this.chainDAO = new ChainDAO(cmd.chainDbPath)
    await this.chainDAO.open()
    this.chainStore = new ChainStore(this.chainDAO, cmd.network)

    const persisted = await this.chainStore.initSyncState()

    // Seed initial UTXO snapshot from chain.db so the renderer can populate
    // before sync makes progress.
    const initialUtxos = await this.chainStore.getAllUtxos(cmd.walletId)
    if (initialUtxos.length > 0) {
      this.events.utxos(initialUtxos)
      let initialBalance = 0n
      for (const u of initialUtxos) initialBalance += BigInt(u.satoshis)
      this.emit({utxoCount: initialUtxos.length, totalBalance: initialBalance.toString()})
    }

    // Resolve resume point: max(persisted, checkpoint) and fall back to
    // genesis if neither is set.
    let resumeHeight = persisted.tipHeight
    let resumeHash = persisted.tipHash
    console.log(`[p2p] persisted state: height=${resumeHeight} hash=${resumeHash ?? 'null'}`)
    if (cmd.startHeight > resumeHeight) {
      resumeHeight = cmd.startHeight
      resumeHash = cmd.startHash
      console.log(`[p2p] checkpoint override: height=${resumeHeight} hash=${resumeHash}`)
    }
    if (!resumeHash) {
      resumeHash = GENESIS_HASH[cmd.network]
      resumeHeight = 1
      console.log(`[p2p] genesis fallback: height=${resumeHeight} hash=${resumeHash}`)
    }
    console.log(`[p2p] starting sync from height=${resumeHeight} hash=${resumeHash} watchAddresses=${this.activeWatchAddresses.length} birthday=${this.activeBirthdayHeight}`)

    // Boot shared peer pool.
    this.peerPool = new PeerPool(cmd.network)
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
      utxoCount: 0,
      totalBalance: '0',
      peerCount: 0,
      filterCapablePeerCount: 0,
    })
  }

  addWatchAddresses = (cmd: P2PAddWatchAddressesMessage): void => {
    if (!this.activeWalletId || cmd.walletId !== this.activeWalletId) return
    const merged = new Set(this.activeWatchAddresses)
    for (const a of cmd.addresses) merged.add(a)
    this.activeWatchAddresses = [...merged]
    this.cfilterSyncWorker?.addWatchAddresses(cmd.addresses)
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
    if (this.chainDAO) {
      await this.chainDAO.close().catch(() => { /* ignore */ })
      this.chainDAO = null
      this.chainStore = null
    }
    this.cfilterStarted = false
  }

  private emit(next: Partial<WalletSyncStatus>): void {
    this.status = {...this.status, ...next, updatedAt: Date.now()}
    this.events.status(this.status)
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
    })
    this.cfilterSyncWorker.on('status', (s: CFilterSyncWorkerStatus) => this.onCFilterStatus(s))
    this.cfilterSyncWorker.on('utxos', (utxos: WalletSyncUtxo[]) => this.events.utxos(utxos))
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
      utxoCount: s.utxoCount,
      totalBalance: s.totalBalance,
      peerCount: Math.max(this.status.peerCount, s.peerCount),
      filterCapablePeerCount: s.filterCapablePeerCount,
    })
  }

  private handleWorkerError(workerName: string, message: string): void {
    const err = `[${workerName}] ${message}`
    console.error(err)
    this.status = {...this.status, lastError: err, updatedAt: Date.now()}
    this.events.status(this.status)
    this.events.error(err)
  }
}