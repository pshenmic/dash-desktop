import {BroadcastService} from '../net/BroadcastService'
import {ChainStore} from '../store/ChainStore'
import {reverseHex, wireToDisplayHex} from '../utils/byteOrder'
import {describeChainDbError, isFatalChainDbError} from '../store/chainDbError'
import {
  CHAINDB_OPEN_ATTEMPTS,
  CHAINDB_OPEN_BACKOFF_MS,
  DEFAULT_PEER_PORT,
  GENESIS,
  LOCK_POOL_MAX_CONNECTIONS,
  LOCK_POOL_MIN_PEERS,
  LOCK_POOL_READY_PEERS,
  MEMPOOL_FETCH_BATCH,
  MEMPOOL_FETCH_INTERVAL_MS,
  MEMPOOL_REPORT_INTERVAL_MS,
  MEMPOOL_SEEN_LIMIT,
  MEMPOOL_SNAPSHOT_PEERS,
  MNLIST_REFRESH_MS,
  NODE_BLOOM,
} from '../constants'
import {evonodeDapiUrls} from '../utils/masternodeList'
import {PoolService} from '../net/PoolService'
import {PeerRegistry} from '../net/peerRegistry'
import {entryTarget} from '../net/peerAddress'
import {bulkPeerShare, peerOverridesKey} from '../net/peerOverrides'
import {dialProbe} from '../net/peerProbe'
import {HeaderSyncWorker} from './workers/HeaderSyncWorker'
import {CFilterSyncWorker} from './workers/CFilterSyncWorker'
import type {ChainLock, HeaderSyncWorkerStatus} from '../types/headerSync'
import type {CFilterSyncWorkerStatus} from '../types/cfilterSync'
import {P2PAddWatchAddressesMessage, P2PBroadcastMessage, P2PListenMessage, P2PReseedUtxosMessage, P2PStartMessage, P2PWatchTxsMessage} from '../types/messages'
import {Network} from '../../src/types/Network'
import {BroadcastResult} from '../types/broadcast'
import {AppliedBlock, AppliedTx, GapExhausted, WalletSyncStatus, WatchAddress} from '../types/walletSync'
import {Inventory, Message, MnListDiff, Peer} from 'dash-core-p2p'
import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {ChainTipState, PersistedHeader} from '../types/chainStore'
import {SyncServiceEvents} from '../types/sync'
import {PeerInfo, PeerOverrides, PeerProbeResult, PoolServiceOptions} from '../types/pool'
import {Logger} from '../../src/utils/logger'

const log = new Logger('p2p')
const locks = new Logger('locks')

// Top-level controller for the p2p utility process: owns ChainStore and the
// pools, spawns workers per session, aggregates their status.
export class SyncService {
  private chainStore: ChainStore | null = null
  // relay:true, always up: lock watching + broadcast.
  private lockPool: PoolService | null = null
  private lockNetwork: Network | null = null
  // relay:false, p2p mode only: headers, cfilters, blocks. Null in static mode,
  // where the pinned peers serve both jobs from the one pool.
  private bulkPool: PoolService | null = null
  // What the workers read: the bulk pool, or the lock pool in static mode.
  private syncPool: PoolService | null = null
  // Both pools claim their sockets here, so a node one of them is connected to
  // is not dialled by the other.
  private readonly peerRegistry = new PeerRegistry()
  private lockOverridesKey: string | null = null
  // Held here rather than read off the overrides at construction: bans arrive
  // while the pools are running and must survive one being rebuilt.
  private banned: string[] = []
  private pinnedOnly = false
  // The user's peers the bulk pool borrowed, kept so they can go back.
  private lentPeers: string[] = []
  private headerSyncWorker: HeaderSyncWorker | null = null
  private cfilterSyncWorker: CFilterSyncWorker | null = null

  private activeWalletId: string | null = null
  private activeWatchAddresses: WatchAddress[] = []
  private activeGapLimit = 0
  private activeBirthdayHeight = 1
  private activeSeedUtxos: P2PStartMessage['seedUtxos'] = []
  private activeUnconfirmedInputOutpoints: P2PStartMessage['unconfirmedInputOutpoints'] = []
  private activeCFilterCursor: number | null = null
  private cfilterStarted = false
  // Display order, not wire order. While non-empty the watcher fetches isdlock
  // objects to match against it.
  private watchedTxids = new Set<string>()
  // Highest ChainLock observed — dedupes repeated clsig emits, and carries the
  // locked hash so a header sync starting later can check its own branch.
  private chainLock: ChainLock | null = null

  // Addresses the lock pool matches mempool txs against. Separate from
  // activeWatchAddresses because rpc mode has no cfilter session to own them.
  private lockWalletId: string | null = null
  private lockAddresses = new Set<string>()
  private mempoolSeen = new Set<string>()
  private mempoolRequests = new Set<Peer>()
  private mempoolFetchQueue: Array<{peer: Peer; txid: string; hash: Uint8Array}> = []
  private mempoolStats = {announced: 0, fetched: 0, matched: 0}
  private mempoolReportTimer: ReturnType<typeof setInterval> | null = null
  private masternodeListVerifiedAt = 0

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
    peerMode: null,
    phaseEtaMs: null,
    lastError: null,
    updatedAt: Date.now(),
  }

  private phaseStart: {phase: WalletSyncStatus['phase']; startedAt: number; startHeight: number} | null = null

  constructor(private readonly events: SyncServiceEvents) {}

  getStatus = (): WalletSyncStatus => this.status

  // Both pools: in dynamic mode they hold different peers, and in static mode
  // the bulk pool does not exist — the pinned one serves sync too.
  getConnectedPeers = (): PeerInfo[] => [
    ...this.lockPool?.peerInfo() ?? [],
    ...this.bulkPool?.peerInfo() ?? [],
  ]

  // A ready peer answered its handshake already; anything else is claimed for
  // the dial, since Core drops both connections on a second one from this host.
  probePeer = async (peer: string, network: Network): Promise<PeerProbeResult> => {
    const target = entryTarget(peer, DEFAULT_PEER_PORT[network])
    if (this.lockNetwork === network && this.getConnectedPeers().some(info => `${info.host}:${info.port}` === target)) {
      return {ok: true, error: null}
    }

    if (!this.peerRegistry.claim(target, this, this)) {
      return {ok: false, error: 'already connected from this host'}
    }
    try {
      return await dialProbe(peer, network)
    } finally {
      this.peerRegistry.release(target, this)
    }
  }

  setBannedPeers = (banned: string[]): void => {
    this.banned = banned
    this.lockPool?.setBanned(banned)
    this.bulkPool?.setBanned(banned)
  }

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
    this.runExclusive(async () => {
      // Changed peer settings rebuild the pool, and in static mode that is the
      // pool the workers hold; main's own `stop` normally gets here first.
      if (this.syncPool && this.lockOverridesKey !== peerOverridesKey(cmd.peerOverrides)) {
        log.info('peer settings changed under a running session — stopping the sync layer')
        await this.teardownBulk()
      }
      this.startLockCore(cmd.network, cmd.peerOverrides)
      this.setLockAddresses(cmd.walletId ?? null, cmd.watchAddresses ?? [])
    })

  // The lock pool is network-scoped and survives a wallet switch, so its match
  // set is replaced wholesale rather than merged.
  private setLockAddresses = (walletId: string | null, addresses: WatchAddress[]): void => {
    const next = new Set(addresses.map(a => a.address))
    const changed = this.lockWalletId !== walletId
      || next.size !== this.lockAddresses.size
      || [...next].some(address => !this.lockAddresses.has(address))
    if (!changed) return

    this.lockWalletId = walletId
    this.lockAddresses = next
    this.mempoolSeen.clear()
    this.mempoolRequests.clear()
    this.mempoolFetchQueue = []
    // A wallet selected after the pool filled, or switched to: the peers that
    // seated were asked against the previous address set, or against none.
    for (const peer of this.lockPool?.readyPeers ?? []) this.requestMempool(peer)
  }

  // A peer announces a tx once, when it first relays it, so one already in the
  // mempool when this session starts is otherwise only seen in a block.
  private requestMempool = (peer: Peer): void => {
    if (!this.lockPool || this.lockAddresses.size === 0) return
    if (this.mempoolRequests.size >= MEMPOOL_SNAPSHOT_PEERS || this.mempoolRequests.has(peer)) return
    // A node started without bloom filters disconnects on the request.
    if (((this.lockPool.peerServices.get(peer) ?? 0n) & BigInt(NODE_BLOOM)) === 0n) return
    this.mempoolRequests.add(peer)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    peer.sendMessage((this.lockPool.messages as any).MemPool())
    locks.info(`mempool requested from ${peer.host}:${peer.port}`)
  }

  // Runs in rpc mode too and survives the bulk layer stopping, so lock waiters
  // outlive a mode switch. Network-scoped: a wallet switch keeps the filled pool.
  private startLockCore = (network: Network, overrides?: PeerOverrides): void => {
    if (overrides) this.setBannedPeers(overrides.bannedPeers)
    const overridesKey = peerOverridesKey(overrides)
    if (this.lockPool && this.lockNetwork === network && this.lockOverridesKey === overridesKey) {
      locks.info(`listen ${network}: pool settings unchanged, keeping ${this.lockPool.readyPeers.size} peer(s)`)
      return
    }

    this.teardownLock()
    this.lockNetwork = network
    this.lockOverridesKey = overridesKey
    this.watchedTxids = new Set()
    this.chainLock = null
    this.masternodeListVerifiedAt = 0

    const pinned = overrides?.mode === 'static' ? overrides.staticPeers : []
    this.pinnedOnly = pinned.length > 0
    // Sized to the pinned set exactly: there is nothing else to dial, so a
    // target above it would pin the pool in its refill branch forever.
    const options: PoolServiceOptions = this.pinnedOnly
      ? {
        registry: this.peerRegistry,
        banned: this.banned,
        label: 'static-pool',
        relay: true,
        pinnedOnly: true,
        peers: pinned,
        readyPeers: pinned.length,
        minPeers: pinned.length,
        maxConnections: pinned.length,
      }
      : {
        registry: this.peerRegistry,
        banned: this.banned,
        label: 'lock-pool',
        relay: true,
        readyPeers: LOCK_POOL_READY_PEERS,
        minPeers: LOCK_POOL_MIN_PEERS,
        maxConnections: LOCK_POOL_MAX_CONNECTIONS,
        dnsSeeds: overrides?.dnsSeeds,
        peers: overrides?.dynamicPeers,
      }
    this.lockPool = new PoolService(network, options)
    this.lockPool.on('peerinv', this.onPeerInvForLocks)
    this.lockPool.on('peerisdlock', this.onIsdlock)
    this.lockPool.on('peertx', this.onTx)
    this.lockPool.on('peerclsig', this.onClsig)
    this.lockPool.on('peergetheaders', this.onPeerTip)
    this.lockPool.on('peermnlistdiff', this.onMasternodeList)
    this.lockPool.on('peeraddr', this.feedBulkPool)
    // Nothing else emits status while the bulk layer is down, so lock-pool
    // churn is a lazy-mode wallet's only signal.
    this.lockPool.on('peerready', this.onLockPeerChange)
    this.lockPool.on('peerdisconnect', this.onLockPeerChange)
    this.lockPool.start()
    // The pool the status reports on just changed, and in rpc mode nothing else
    // emits until a peer seats — which would leave the old mode on show.
    this.emit({})

    this.mempoolReportTimer = setInterval(this.reportMempoolWatch, MEMPOOL_REPORT_INTERVAL_MS)
    this.mempoolReportTimer.unref?.()
  }

  // Counts rather than per-tx lines: a busy mainnet mempool would be thousands
  // of lines an hour, and `watching 0` is a wallet that never sent its addresses.
  private reportMempoolWatch = (): void => {
    const {announced, fetched, matched} = this.mempoolStats
    this.mempoolStats = {announced: 0, fetched: 0, matched: 0}
    locks.info(
      `mempool watch: ${announced} announced, ${fetched} fetched, ${matched} ours ` +
      `(watching ${this.lockAddresses.size} address(es))`,
    )
  }

  private onLockPeerChange = (peer: Peer): void => {
    if (!this.lockPool?.readyPeers.has(peer)) this.mempoolRequests.delete(peer)
    if (this.lockPool?.readyPeers.size === 0) this.mempoolRequests.clear()
    for (const ready of this.lockPool?.readyPeers ?? []) this.requestMempool(ready)
    this.emit({})
    this.feedBulkPool()
  }

  // The bulk pool has no DNS seed, so this is its only supply — driven off peer
  // events too, since at creation the lock pool's book is still just DNS entries.
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
    this.activeSeedUtxos = cmd.seedUtxos
    this.activeUnconfirmedInputOutpoints = cmd.unconfirmedInputOutpoints
    this.activeCFilterCursor = cmd.cfilterCursor
    this.cfilterStarted = false
    this.setLockAddresses(cmd.walletId, this.activeWatchAddresses)

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
      peerMode: null,
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
      const labelled = `chain.db unusable (${code}): ${describeChainDbError(err)}. Call resetWalletSync to recover.`
      await this.chainStore.close().catch(() => { /* ignore */ })
      this.chainStore = null
      this.emit({phase: 'stopped', lastError: labelled})
      this.events.error(labelled)
      return
    }

    // Resume from persisted tip, or genesis on a fresh chain.db.
    let resumeHeight = persisted.tipHeight
    let resumeHash = persisted.tipHash
    log.info(`persisted state: height=${resumeHeight} hash=${resumeHash ?? 'null'}`)
    if (!resumeHash) {
      resumeHash = GENESIS[cmd.network].hash
      resumeHeight = GENESIS[cmd.network].height
      log.info(`genesis fallback: height=${resumeHeight} hash=${resumeHash}`)
    }
    log.info(`starting sync from height=${resumeHeight} hash=${resumeHash} watchAddresses=${this.activeWatchAddresses.length} birthday=${this.activeBirthdayHeight} seedUtxos=${this.activeSeedUtxos.length} unconfirmedInputs=${this.activeUnconfirmedInputOutpoints.length} cursor=${this.activeCFilterCursor ?? 'null'}`)

    if (this.pinnedOnly) {
      // One pool, both jobs: a second pool dialling the same pinned hosts would
      // drop both connections to every one of them.
      this.syncPool = this.lockPool
    } else {
      // `relay: false` drops the tx inv stream these workers never read; Core
      // gates ISLOCK/ISDLOCK behind the same flag, so locks stay on the other pool.
      this.lentPeers = bulkPeerShare(cmd.peerOverrides?.dynamicPeers)
      this.bulkPool = new PoolService(cmd.network, {
        registry: this.peerRegistry,
        banned: this.banned,
        label: 'bulk-pool',
        relay: false,
        dnsSeed: false,
        peers: this.lentPeers,
      })
      // Before the first dial: the lock pool has held these since boot, and the
      // registry hands a contested node to whoever claimed it first.
      this.lockPool?.dropPeers(this.lentPeers)
      this.feedBulkPool()
      this.bulkPool.start()
      this.syncPool = this.bulkPool
    }
    if (!this.syncPool) {
      const message = 'peer pool failed to start'
      this.emit({phase: 'stopped', lastError: message})
      this.events.error(message)
      return
    }

    // CFilterSyncWorker boots lazily once header sync reports 'synced', so the
    // two never compete for chain.db state mid-sync.
    this.headerSyncWorker = new HeaderSyncWorker({
      chainStore: this.chainStore,
      peerPool: this.syncPool,
      initialTipHeight: resumeHeight,
      initialTipHash: resumeHash,
      chainLock: this.chainLock,
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
    this.activeUnconfirmedInputOutpoints = []
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
      peerMode: null,
      phaseEtaMs: null,
    })
  }

  private async openWithRetry(store: ChainStore): Promise<ChainTipState> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= CHAINDB_OPEN_ATTEMPTS; attempt++) {
      try {
        await store.open()
        return await store.initSyncState()
      } catch (err) {
        lastErr = err
        await store.close().catch(() => { /* ignore */ })
        if (attempt < CHAINDB_OPEN_ATTEMPTS) {
          log.warn(`chain.db open attempt ${attempt}/${CHAINDB_OPEN_ATTEMPTS} failed, retrying: ${describeChainDbError(err)}`)
          await new Promise(resolve => setTimeout(resolve, CHAINDB_OPEN_BACKOFF_MS))
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
    if (this.lockWalletId === cmd.walletId) {
      this.setLockAddresses(cmd.walletId, this.activeWatchAddresses)
    }
    this.cfilterSyncWorker?.addWatchAddresses(cmd.addresses, cmd.rewindToHeight)
  }

  reseedUtxos = (cmd: P2PReseedUtxosMessage): void => {
    if (cmd.walletId !== this.activeWalletId) return
    this.activeSeedUtxos = cmd.utxos
    this.activeUnconfirmedInputOutpoints = cmd.unconfirmedInputOutpoints
    this.cfilterSyncWorker?.reseedUtxos(cmd.utxos, cmd.unconfirmedInputOutpoints)
  }

  watchTxs = (cmd: P2PWatchTxsMessage): void => {
    const before = this.watchedTxids.size
    if (cmd.mode === 'replace') {
      this.watchedTxids = new Set(cmd.txids)
    } else {
      for (const txid of cmd.txids) this.watchedTxids.add(txid)
    }
    // A wallet with nothing unconfirmed re-sends an empty replace on every
    // refresh; only a change in what is armed says anything.
    if (this.watchedTxids.size === 0 && before === 0) return
    locks.debug(`watchTxs ${cmd.mode} (${this.watchedTxids.size}): ${[...this.watchedTxids].join(',') || '(none)'}`)
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
    const wantChainlocks = this.watchedTxids.size > 0 || this.syncPool != null
    const wanted: Array<{type: number; hash: Uint8Array}> = []
    // A queue with entries in it already has a drain pending, and an arrival
    // waits for that tick rather than jumping the pacing.
    const idle = this.mempoolFetchQueue.length === 0
    for (const item of msg.inventory ?? []) {
      if (item.type === Inventory.TYPE.TX) {
        // An inv carries no outputs, so telling whether a tx pays us means
        // fetching it. Every peer announces the same one, hence the seen set.
        this.mempoolStats.announced++
        if (this.lockAddresses.size === 0) continue
        const txid = wireToDisplayHex(item.hash)
        if (this.mempoolSeen.has(txid)) continue
        if (this.mempoolSeen.size >= MEMPOOL_SEEN_LIMIT) this.mempoolSeen.clear()
        this.mempoolSeen.add(txid)
        this.mempoolFetchQueue.push({peer, txid, hash: item.hash})
      } else if (item.type === Inventory.TYPE.BLOCK) {
        this.requestMasternodeList(peer, wireToDisplayHex(item.hash))
      } else if (item.type === Inventory.TYPE.CLSIG) {
        if (wantChainlocks) wanted.push({type: item.type, hash: item.hash})
      } else if (item.type === Inventory.TYPE.ISDLOCK) {
        const hashHex = wireToDisplayHex(item.hash)
        if (this.watchedTxids.size > 0) {
          locks.debug(`isdlock inv ${hashHex} — requesting getdata (watching ${this.watchedTxids.size})`)
          wanted.push({type: item.type, hash: item.hash})
        } else {
          locks.debug(`isdlock inv ${hashHex} — skipped, watch set empty`)
        }
      }
    }
    // Locks go out with this inv rather than through the queue: there are a
    // handful of them and a delayed one is a delayed confirmation.
    if (wanted.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      peer.sendMessage((this.lockPool.messages as any).GetData(wanted))
    }
    if (idle && this.mempoolFetchQueue.length > 0) this.fetchQueuedMempoolTxs()
  }

  // A `mempool` answer carries the peer's whole pool in one inv, so asking for
  // all of it at once is the session's largest burst.
  private fetchQueuedMempoolTxs = (): void => {
    if (!this.lockPool) return
    const byPeer = new Map<Peer, Array<{type: number; hash: Uint8Array}>>()
    for (const entry of this.mempoolFetchQueue.splice(0, MEMPOOL_FETCH_BATCH)) {
      // Only the peer that announced it is known to hold it. It left, so the
      // txid is un-seen for the next announcement to fetch.
      if (!this.lockPool.readyPeers.has(entry.peer)) {
        this.mempoolSeen.delete(entry.txid)
        continue
      }
      const items = byPeer.get(entry.peer) ?? []
      items.push({type: Inventory.TYPE.TX, hash: entry.hash})
      byPeer.set(entry.peer, items)
    }
    for (const [peer, items] of byPeer) {
      this.mempoolStats.fetched += items.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      peer.sendMessage((this.lockPool.messages as any).GetData(items))
    }

    if (this.mempoolFetchQueue.length === 0) return
    setTimeout(this.fetchQueuedMempoolTxs, MEMPOOL_FETCH_INTERVAL_MS).unref?.()
  }

  // isdlock.txid is wire/internal byte order; our watch set is display order.
  private onIsdlock = (_peer: Peer, msg: Message & {txid?: string}): void => {
    if (!msg.txid) {
      locks.info('isdlock received without a txid')
      return
    }
    const displayTxid = reverseHex(msg.txid)
    const matched = this.watchedTxids.has(displayTxid)
    locks.info(`isdlock received wire=${msg.txid} display=${displayTxid} matched=${matched} watching=[${[...this.watchedTxids].join(',')}]`)
    if (!matched) return
    this.watchedTxids.delete(displayTxid)
    // Serialized for InstantAssetLockProof construction in main. We broadcast L1
    // over this pool, so DAPI's subscribeToTransactions never delivers this lock.
    const islockHex = Buffer.from((msg as unknown as {getPayload(): Uint8Array}).getPayload()).toString('hex')
    this.events.txInstantLocked(displayTxid, islockHex)
  }

  // Outputs are matched here rather than in main so a mempool we mostly do not
  // care about never crosses the process boundary.
  private onTx = (_peer: Peer, msg: Message & {transaction?: unknown}): void => {
    if (!this.lockNetwork || !this.lockWalletId || this.lockAddresses.size === 0) return

    const tx = msg.transaction as SDKTransaction | undefined
    if (!tx || tx.outputs.length === 0) return

    const label = this.lockNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'
    const outputs = tx.outputs.map((output, vout) => {
      const address = output.getAddress(label) ?? null
      return {
        vout,
        address,
        satoshis: output.satoshis.toString(),
        isMine: address != null && this.lockAddresses.has(address),
      }
    })
    if (!outputs.some(o => o.isMine)) return

    const applied: AppliedTx = {
      txid: tx.hash(),
      raw: tx.bytes(),
      inputs: tx.inputs.map((input, vin) => ({
        vin,
        prevTxid: input.txId,
        prevVout: input.vOut,
        sequence: input.sequence,
      })),
      outputs,
    }
    this.mempoolStats.matched++
    locks.info(`incoming mempool tx ${applied.txid} paying ${outputs.filter(o => o.isMine).length} of our output(s)`)
    this.events.incomingTx(this.lockWalletId, applied)
  }

  private onClsig = (_peer: Peer, msg: Message & {height?: number; blockHash?: string}): void => {
    if (!this.lockNetwork) return
    const height = msg.height ?? 0
    if (this.chainLock != null && height <= this.chainLock.height) return

    const hash = reverseHex(msg.blockHash ?? '')
    // The height alone cannot say which branch is locked, and the all-zero
    // default reads as a block nobody holds.
    if (hash.length !== 64 || !/[1-9a-f]/.test(hash)) {
      locks.warn(`chainlock h=${height} carries no block hash — ignored`)
      return
    }

    this.chainLock = {height, hash}
    this.headerSyncWorker?.noteChainLock(height, hash)
    locks.info(`chainlock h=${height} ${hash} — ${this.headerSyncWorker ? 'checking our branch' : 'no header sync'}`)
    this.events.chainLocked(this.lockNetwork, height)
  }

  // Core opens every connection with a getheaders whose locator starts at its tip.
  // A peer still syncing would name a block long buried, so only the highest count.
  private onPeerTip = (peer: Peer, msg: Message & {starts?: Uint8Array[]}): void => {
    const best = Math.max(...[...this.lockPool?.readyPeers ?? []].map(ready => ready.bestHeight ?? 0))
    const tip = msg.starts?.[0]
    if (tip != null && (peer.bestHeight ?? 0) >= best) this.requestMasternodeList(peer, wireToDisplayHex(tip))
  }

  // A peer is asked for a block it announced itself, so it always holds it; a reply
  // is checked against its own coinbase, so the first verified one wins.
  private requestMasternodeList(peer: Peer, blockHash: string): void {
    if (!this.lockPool || Date.now() - this.masternodeListVerifiedAt < MNLIST_REFRESH_MS) return
    log.info(`asking ${peer.host}:${peer.port} for the masternode list at ${blockHash}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    peer.sendMessage((this.lockPool.messages as any).GetMnListDiff({blockHash}))
  }

  private onMasternodeList = (peer: Peer, msg: Message & {mnlistdiff?: MnListDiff}): void => {
    // A peer answering after the list verified would only repeat it.
    if (!this.lockNetwork || msg.mnlistdiff == null || Date.now() - this.masternodeListVerifiedAt < MNLIST_REFRESH_MS) return
    const dapiUrls = evonodeDapiUrls(msg.mnlistdiff)
    if (dapiUrls == null) {
      log.warn(`${peer.host}:${peer.port} sent a masternode list its coinbase does not commit to`)
      return
    }
    this.masternodeListVerifiedAt = Date.now()
    log.info(`masternode list at ${msg.mnlistdiff.blockHash} from ${peer.host}:${peer.port}: ${dapiUrls.length} evonode DAPI url(s)`)
    this.events.evonodeDapiUrls(this.lockNetwork, dapiUrls)
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
      // Addresses move rather than copy, so by now the lock pool's whole surplus
      // lives here, and a lock pool long past gossiping has no other source.
      if (this.lockPool && this.lockPool.network === this.bulkPool.network) {
        this.lockPool.addAddresses(this.bulkPool.takeAddresses(0))
        // takeAddresses moves what is spare, and a lent peer is the one entry
        // here most likely to be connected — so it is handed back by name.
        this.lockPool.addPeers(this.lentPeers)
      }
      this.lentPeers = []
      this.bulkPool.stop()
      this.bulkPool.removeAllListeners()
      this.bulkPool = null
    }
    this.syncPool = null
    if (this.chainStore) {
      await this.chainStore.close().catch(() => { /* ignore */ })
      this.chainStore = null
    }
    this.cfilterStarted = false
  }

  private teardownLock(): void {
    this.lockNetwork = null
    this.lockOverridesKey = null
    if (this.syncPool === this.lockPool) this.syncPool = null
    if (this.mempoolReportTimer) clearInterval(this.mempoolReportTimer)
    this.mempoolReportTimer = null
    this.mempoolFetchQueue = []
    this.mempoolRequests.clear()
    if (!this.lockPool) return
    this.lockPool.stop()
    this.lockPool.removeAllListeners()
    this.lockPool = null
  }

  private emit(next: Partial<WalletSyncStatus>): void {
    const merged = {...this.status, ...next, updatedAt: Date.now()}
    // Owned here rather than by the workers: the pools outlive them, and fill
    // with peers through phases no worker is running in.
    merged.lockPeerCount = this.lockPool?.readyPeers.size ?? 0
    merged.peerMode = this.lockPool == null ? null : this.pinnedOnly ? 'static' : 'dynamic'
    merged.filterCapablePeerCount = this.syncPool?.filterCapablePeers.size ?? 0
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

    if (s.phase === 'synced' && !this.cfilterStarted && this.chainStore && this.syncPool && s.tipHash) {
      this.cfilterStarted = true
      this.startCFilterWorker(s.tipHeight, s.tipHash).catch(err =>
        this.handleWorkerError('CFilterSyncWorker', err instanceof Error ? err.message : String(err))
      )
    }
  }

  private async startCFilterWorker(tipHeight: number, tipHashDisplayHex: string): Promise<void> {
    if (!this.chainStore || !this.syncPool || !this.activeWalletId) return
    this.cfilterSyncWorker = new CFilterSyncWorker({
      network: this.chainStore.network,
      walletId: this.activeWalletId,
      chainStore: this.chainStore,
      peerPool: this.syncPool,
      chainTipHeight: tipHeight,
      chainTipHashDisplayHex: tipHashDisplayHex,
      watchAddresses: this.activeWatchAddresses,
      gapLimit: this.activeGapLimit,
      birthdayHeight: this.activeBirthdayHeight,
      seedUtxos: this.activeSeedUtxos,
      unconfirmedInputOutpoints: this.activeUnconfirmedInputOutpoints,
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
    })
  }

  private handleWorkerError(workerName: string, message: string): void {
    const fatal = isFatalChainDbError(message)
    const err = fatal
      ? `[${workerName}] chain.db unusable: ${message}. Call resetWalletSync to recover.`
      : `[${workerName}] ${message}`
    log.error(err)
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
