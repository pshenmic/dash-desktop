import {utilityProcess, UtilityProcess} from 'electron'
import path from 'path'
import fs from 'fs'
import {ADDRESS_LOOKAHEAD, ChainStorageFilename, LOCK_WATCH_SWEEP_INTERVAL_MS, LOCK_WATCH_TTL_MS} from '../../constants'
import {dataPath} from '../../utils/dataPath'
import {Address} from '../../types/Address'
import {logChildOutput} from '../../logger'
import {WalletDAO} from '../../database/WalletDAO'
import {
  CHILD_OUTPUT_TAIL_LIMIT,
  PERSIST_ATTEMPTS,
  PERSIST_RETRY_MS,
  REBROADCAST_INTERVAL_MS,
} from '../../constants'
import {AddressDAO} from '../../database/AddressDAO'
import {TransactionDAO} from '../../database/TransactionDAO'
import {P2PCommand, P2PEvent} from '../../../p2p/types/messages'
import {BroadcastPolicyOverrides, BroadcastResult} from '../../../p2p/types/broadcast'
import {AppliedBlock, AppliedTx, GapExhausted, WalletSyncStatus, WalletSyncUtxo, WatchAddress} from '../../../p2p/types/walletSync'
import {randomUUID} from 'crypto'
import {GENESIS} from '../../../p2p/constants'
import {ScanCursorGate} from '../../utils/scanCursorGate'
import {Preferences} from '../../preferences'
import {Network} from '../../types/Network'
import {Transaction as SDKTransaction} from 'dash-core-sdk'


// Main-process facade for wallet sync: forks the p2p utility process and
// persists the per-block effects it emits through TransactionDAO. The utility
// process holds no wallet state — it receives seedUtxos + cfilterCursor in the
// start command and sends blockApplied / cursorAdvanced back for SQL here.
export class WalletSyncService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private transactionDAO: TransactionDAO
  // Read at send time, not construction: the pools pick up an edited seed list
  // on the next start rather than needing a relaunch.
  private preferences: Preferences
  private child: UtilityProcess | null = null
  // Holds a 'stopped' snapshot before the fork and after exit, so the renderer
  // never sees null.
  private status: WalletSyncStatus = {
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
    lastError: null,
    updatedAt: Date.now(),
  }
  private activeWalletId: string | null = null
  private activeNetwork: 'mainnet' | 'testnet' | null = null
  // Re-pushes unconfirmed local txs on an interval while a wallet is synced.
  private rebroadcastTimer: ReturnType<typeof setInterval> | null = null
  private lockWatchSweepTimer: ReturnType<typeof setInterval> | null = null
  // Rolling stdout+stderr tail, so a crash carries its own cause instead of a
  // bare exit code.
  private childOutputTail = ''
  // Keyed by requestId, which the utility process echoes back, so overlapping
  // broadcasts resolve the right promise.
  private pendingBroadcasts = new Map<string, (event: {ok: boolean; result: BroadcastResult; errorMessage: string | null}) => void>()
  onWalletActivity: ((walletId: string) => void) | null = null
  private activityDebounce: ReturnType<typeof setTimeout> | null = null
  onGapExhausted: ((gap: GapExhausted) => void) | null = null
  // Wallets whose scan is held waiting for addresses. The worker resumes at the
  // held height, so the addresses answering it must not also rewind the cursor.
  private gapHeld = new Set<string>()
  // txid -> serialized isdlock (hex), feeding InstantAssetLockProof
  // construction for shield / asset-lock funding.
  private instantLocks = new Map<string, string>()
  private instantLockWaiters = new Map<string, Array<(hex: string) => void>>()
  // Highest clsig height the lock pool has reported, per network. A chainlock
  // is a threshold rather than an event: a waiter for a height already passed
  // has to resolve without waiting for the next block's clsig.
  private chainlockedHeights = new Map<Network, number>()
  private chainLockWaiters = new Set<{network: Network; minHeight: number; notify: (height: number) => void}>()
  private phaseWaiters = new Set<{phase: WalletSyncStatus['phase']; notify: () => void}>()
  // Txids armed for lock capture that SQL does not know are pending yet, held
  // here so the periodic replace-mode refresh cannot drop them.
  private armedLockTxids = new Map<string, number>()
  private lockListenNetwork: 'mainnet' | 'testnet' | null = null
  private lockListenWalletId: string | undefined = undefined
  // The worker emits cursorAdvanced at the end of every scan regardless of what
  // landed, so without this the resume marker steps over a block that failed to
  // reach SQL and its coins are gone until a full resetSync.
  private cursorGate = new ScanCursorGate()
  // Sticky: status snapshots arrive wholesale from the utility process and
  // would otherwise overwrite lastError on the next push.
  private persistenceError: string | null = null
  // Serialises block writes, cursor advances and cursor rewinds so they land
  // in emit order.
  private persistQueue: Promise<void> = Promise.resolve()

  constructor(walletDAO: WalletDAO, addressDAO: AddressDAO, transactionDAO: TransactionDAO, preferences: Preferences) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.transactionDAO = transactionDAO
    this.preferences = preferences
  }

  private ensureChild(): UtilityProcess {
    if (this.child) return this.child

    const scriptPath = path.join(__dirname, 'p2p.js')
    this.childOutputTail = ''
    const child = utilityProcess.fork(scriptPath, [], { serviceName: 'p2p', stdio: ['ignore', 'pipe', 'pipe'] })

    // Mirror the worker's output to the main-process streams (preserving the
    // previous 'inherit' visibility) while retaining a tail for crash reports.
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this.childOutputTail = (this.childOutputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
      logChildOutput('p2p', text, false)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this.childOutputTail = (this.childOutputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
      logChildOutput('p2p', text, true)
    })

    child.on('message', (data: P2PEvent) => this.handleP2PEvent(data))

    child.on('exit', code => {
      const tail = this.childOutputTail.trim()
      console.log(`[p2p] utility process exited code=${code}`)
      if (tail) console.error(`[p2p] last output before exit:\n${tail}`)
      this.child = null
      // The utility process can no longer answer these, and the caller's
      // promise would hang forever. The output tail rides along so the crash
      // cause travels with the rejection.
      const crashDetail = tail ? `\n--- p2p output (tail) ---\n${tail}` : ''
      for (const [requestId, resolve] of this.pendingBroadcasts) {
        resolve({
          ok: false,
          result: {
            txid: '', peersInvited: 0, peersAcked: [], peersDelivered: [], peersPropagated: [],
            instantLocked: false, islockHex: null, lockLatencyMs: null,
            waitedForLock: false, rejections: [], durationMs: 0,
          },
          errorMessage: `p2p utility process exited (code=${code}) before broadcast ${requestId} completed${crashDetail}`,
        })
      }
      this.pendingBroadcasts.clear()
      this.notifyPhase('stopped')
      this.status = {
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
        lastError: null,
        updatedAt: Date.now(),
      }
      this.stopRebroadcastLoop()
      this.activeNetwork = null
      this.activeWalletId = null
    })

    this.child = child
    return child
  }

  private handleP2PEvent(data: P2PEvent): void {
    if (data.type === 'status') {
      this.status = data.status
      this.notifyPhase(data.status.phase)
    } else if (data.type === 'blockApplied') {
      this.persistAppliedBlock(data.block)
    } else if (data.type === 'cursorAdvanced') {
      this.enqueuePersist(() => this.advanceCursorGated(data.walletId, data.height))
    } else if (data.type === 'cursorReset') {
      this.enqueuePersist(() => this.transactionDAO.resetCursor(data.walletId, data.height))
    } else if (data.type === 'incomingTx') {
      this.enqueuePersist(() => this.recordIncomingTx(data.walletId, data.tx))
    } else if (data.type === 'chainRewound') {
      // On the persist queue so the orphaned blocks' own writes land before they
      // are undone. The reseed is also what resumes the worker's held scan.
      this.enqueuePersist(async () => {
        await this.transactionDAO.rewindToHeight(data.walletId, data.height)
        const utxos = await this.transactionDAO.getUtxos(data.walletId)
        console.warn(`[walletSync] reorg: un-confirmed everything above h=${data.height}; reseeding ${utxos.length} utxo(s)`)
        this.send({type: 'reseedUtxos', walletId: data.walletId, utxos})
      })
    } else if (data.type === 'gapExhausted') {
      this.gapHeld.add(data.gap.walletId)
      console.log(
        `[discovery] scan held at h=${data.gap.height}: ${data.gap.isChange ? 'change' : 'receiving'} ` +
        `lastUsed=${data.gap.lastUsedIndex} maxIndex=${data.gap.maxIndex} — deriving more addresses`,
      )
      // After the queued writes for the blocks that caused this, or discovery
      // reads a SQL state that does not yet show the usage. Not *on* the queue:
      // the discovery it triggers enqueues its own cursor write.
      this.persistQueue.catch(() => undefined).then(() => this.onGapExhausted?.(data.gap))
    } else if (data.type === 'broadcastResult') {
      const resolve = this.pendingBroadcasts.get(data.requestId)
      if (resolve) {
        this.pendingBroadcasts.delete(data.requestId)
        resolve({ok: data.ok, result: data.result, errorMessage: data.errorMessage})
      }
    } else if (data.type === 'txInstantLocked') {
      this.transactionDAO.markInstantLocked(data.txid).catch(err =>
        console.error('[walletSync] markInstantLocked failed:', err)
      )
      this.recordInstantLock(data.txid, data.islockHex)
    } else if (data.type === 'chainLocked') {
      this.transactionDAO.markChainlockedUpTo(data.network, data.height).catch(err =>
        console.error('[walletSync] markChainlockedUpTo failed:', err)
      )
      this.recordChainLock(data.network, data.height)
    } else if (data.type === 'error') {
      console.error('[p2p] utility process error:', data.message)
    }
  }

  private send(command: P2PCommand): void {
    this.ensureChild().postMessage(command)
  }

  private notifyPhase(phase: WalletSyncStatus['phase']): void {
    for (const waiter of this.phaseWaiters) {
      if (waiter.phase !== phase) continue
      this.phaseWaiters.delete(waiter)
      waiter.notify()
    }
  }

  // Used by shutdown to confirm chain.db closed before the process is killed.
  // Resolves on the deadline as well as the phase: the caller kills the child
  // either way, and a worker that dies without a final status still reaches
  // 'stopped' through the exit handler.
  private waitForPhase(phase: WalletSyncStatus['phase'], timeoutMs: number): Promise<void> {
    if (this.status.phase === phase) return Promise.resolve()

    return new Promise<void>(resolve => {
      const waiter = {phase, notify: (): void => {
        clearTimeout(timer)
        resolve()
      }}
      const timer = setTimeout(() => {
        this.phaseWaiters.delete(waiter)
        resolve()
      }, timeoutMs)
      timer.unref?.()
      this.phaseWaiters.add(waiter)
    })
  }

  // Ack only: returning a status snapshot here handed the renderer a stale
  // 'stopped', because the utility process had not yet emitted 'connecting'.
  // Phase progression streams via getStatus instead.
  startSync = async (walletId: string): Promise<void> => {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`)
    }
    const network = wallet.network as 'mainnet' | 'testnet'

    if (this.activeWalletId && this.activeWalletId !== walletId) {
      this.send({ type: 'stop' })
    }

    // Only this wallet's addresses go into the watch set.
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const watchAddresses = [...grouped.receiving, ...grouped.change].map(toWatchAddress)

    this.gapHeld.delete(walletId)
    this.activeWalletId = walletId
    this.activeNetwork = network
    // The persisted cursor is already capped below any gap, so this scan
    // re-covers it — the previous session's failures stop applying here.
    this.cursorGate.clear(walletId)
    if (!this.cursorGate.hasFailures()) this.persistenceError = null
    this.startRebroadcastLoop()
    // Seed the worker's in-memory spend-detection map from SQL.
    const seedUtxos = await this.transactionDAO.getUtxos(walletId)
    const cfilterCursor = await this.transactionDAO.getCursor(walletId)

    const chainDbPath = dataPath(ChainStorageFilename, network)
    try {
      fs.mkdirSync(chainDbPath, {recursive: true})
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to create chain.db directory: ${message}`)
    }

    this.send({
      type: 'start',
      network,
      walletId,
      chainDbPath,
      watchAddresses,
      gapLimit: ADDRESS_LOOKAHEAD,
      seedUtxos,
      cfilterCursor,
      peerOverrides: this.preferences.network[network],
      // birthdayHeight is intentionally undefined — defaults to genesis in the
      // utility process. Replace with a per-wallet birthday once the wallet
      // schema captures it.
    })
  }

  stopSync = (): void => {
    this.stopRebroadcastLoop()
    this.activeNetwork = null
    if (!this.child) return
    this.send({ type: 'stop' })
    this.activeWalletId = null
  }

  // Rewinding the cursor to genesis re-matches history against the new
  // addresses, and is skipped only when one is provably fresh: forwardOnly
  // (just derived at the frontier, never published) or the persisted
  // initial-scan latch (first full scan done and gap discovery converged).
  //
  // The live 'synced' phase is deliberately not a skip signal: during a restore
  // the scan can hit the tip and flip to 'synced' exactly as the final gap batch
  // is derived, and those addresses may still carry pre-tip history.
  addWatchAddresses = async (
    walletId: string,
    addresses: Address[],
    opts: {forwardOnly?: boolean} = {},
  ): Promise<void> => {
    if (addresses.length === 0) return
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (!wallet) return
    const network = wallet.network as 'mainnet' | 'testnet'

    // A held scan already stopped at the block that exhausted the gap and will
    // resume from there, so there is nothing behind it left to re-match.
    const answersHold = this.gapHeld.delete(walletId)
    const scannedOnce = await this.transactionDAO.getInitialScanComplete(walletId)
    const skipRewind = answersHold || opts.forwardOnly === true || scannedOnce
    const rewindToHeight = skipRewind ? undefined : GENESIS[network].height

    console.log(
      `[discovery] watching ${addresses.length} new address(es): ` +
      (answersHold ? 'resuming held scan'
        : rewindToHeight == null ? 'forward-only'
        : `rescanning from h=${rewindToHeight}`),
    )

    if (rewindToHeight != null) {
      // Through the persist queue: applied directly, a cursorAdvanced enqueued
      // before this rewind would run after it, and advanceCursor's MAX would
      // swallow the reset.
      await this.enqueuePersist(() => this.transactionDAO.resetCursor(walletId, rewindToHeight))
    }
    if (!this.child) return
    this.send({type: 'addWatchAddresses', walletId, addresses: addresses.map(toWatchAddress), rewindToHeight})
  }

  getStatus = (): WalletSyncStatus => {
    if (this.persistenceError == null) return this.status
    return {...this.status, lastError: this.persistenceError}
  }

  private recordInstantLock(txid: string, islockHex: string): void {
    this.instantLocks.set(txid, islockHex)
    this.disarmLockWatch(txid)
    const waiters = this.instantLockWaiters.get(txid)
    if (waiters) {
      this.instantLockWaiters.delete(txid)
      for (const w of waiters) w(islockHex)
    }
  }

  // The worker's set only shrinks when we reinstall it, and the periodic
  // refresh belongs to the rebroadcast loop, which rpc mode never starts.
  private disarmLockWatch(txid: string): void {
    if (!this.armedLockTxids.delete(txid)) return
    this.refreshWatchedTxids().catch(err =>
      console.error('[walletSync] refreshWatchedTxids failed:', err))
  }

  // Runs in both connection modes: an rpc-mode wallet still needs InstantSend
  // locks for asset-lock funding, and nothing else listens for them.
  startLockListen = async (network: 'mainnet' | 'testnet', walletId?: string): Promise<void> => {
    if (this.lockListenNetwork === network && this.lockListenWalletId === walletId && this.child) return
    this.lockListenNetwork = network
    this.lockListenWalletId = walletId
    // Without addresses the pool still watches locks and broadcasts; it just
    // cannot tell whether a mempool tx pays us.
    const grouped = walletId ? await this.addressDAO.getAddressesByWalletId(walletId) : null
    const watchAddresses = grouped ? [...grouped.receiving, ...grouped.change].map(toWatchAddress) : undefined
    this.send({
      type: 'listen',
      network,
      walletId,
      watchAddresses,
      peerOverrides: this.preferences.network[network],
    })
    this.startLockWatchSweep()
  }

  private startLockWatchSweep(): void {
    if (this.lockWatchSweepTimer) return
    this.lockWatchSweepTimer = setInterval(() => {
      this.refreshWatchedTxids().catch(err =>
        console.error('[walletSync] lock watch sweep failed:', err))
    }, LOCK_WATCH_SWEEP_INTERVAL_MS)
    this.lockWatchSweepTimer.unref?.()
  }

  private stopLockWatchSweep(): void {
    if (!this.lockWatchSweepTimer) return
    clearInterval(this.lockWatchSweepTimer)
    this.lockWatchSweepTimer = null
  }

  // Arm lock capture for a txid. Without this the utility process never issues
  // the getdata an ISDLOCK inv requires, so the lock is seen and dropped.
  watchForInstantLock = (txid: string): void => {
    if (!this.child) return
    this.armedLockTxids.set(txid, Date.now())
    this.send({type: 'watchTxs', mode: 'add', txids: [txid]})
  }

  // Null if no isdlock arrives within timeoutMs.
  //
  // Arms the txid itself rather than trusting the caller to have done it: a
  // funding resumed after a restart reaches here with a watch set the new child
  // process never received, and an unarmed tx has its lock seen and dropped.
  // Arming also lifts the worker's chainlock gate, which is what feeds
  // waitForChainLock in rpc mode.
  waitForInstantLock = (txid: string, timeoutMs: number): Promise<string | null> => {
    const cached = this.instantLocks.get(txid)
    if (cached) return Promise.resolve(cached)
    if (!this.armedLockTxids.has(txid)) this.watchForInstantLock(txid)
    return new Promise<string | null>(resolve => {
      let done = false
      const finish = (hex: string | null): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        const arr = this.instantLockWaiters.get(txid)
        if (arr) {
          const i = arr.indexOf(onLock)
          if (i >= 0) arr.splice(i, 1)
          if (arr.length === 0) this.instantLockWaiters.delete(txid)
        }
        resolve(hex)
      }
      const onLock = (hex: string): void => finish(hex)
      // Deliberately does not disarm: an unanswered islock does not mean the
      // funding is over, and emptying the watch set here would also shut off
      // the worker's chainlock stream, which the caller may still be waiting
      // on. The TTL sweep expires the arm instead.
      const timer = setTimeout(() => finish(null), timeoutMs)
      timer.unref?.()
      const arr = this.instantLockWaiters.get(txid) ?? []
      arr.push(onLock)
      this.instantLockWaiters.set(txid, arr)
    })
  }

  hasInstantLock = (txid: string): boolean => this.instantLocks.has(txid)

  private recordChainLock(network: Network, height: number): void {
    if (height <= (this.chainlockedHeights.get(network) ?? 0)) return
    this.chainlockedHeights.set(network, height)

    const woken: number[] = []
    for (const waiter of this.chainLockWaiters) {
      if (waiter.network !== network || height < waiter.minHeight) continue
      this.chainLockWaiters.delete(waiter)
      woken.push(waiter.minHeight)
      waiter.notify(height)
    }

    // Silent while nobody is waiting — the child already logs every clsig. This
    // line is the only place the crossing into main is observable.
    if (woken.length > 0) {
      console.log(`[locks] chainlock h=${height} woke ${woken.length} waiter(s) for h>=${Math.min(...woken)}`)
    }
  }

  chainlockedHeight = (network: Network): number => this.chainlockedHeights.get(network) ?? 0

  // Resolves with the chainlocked height once it reaches minHeight, or null on
  // timeout. Fed by the lock pool's clsig stream, which is up in both connection
  // modes — so this answers locally what polling DAPI for coreChainLockedHeight
  // asks a remote service for.
  //
  // A chainlock only ever moves forward, so an already-passed height resolves
  // without waiting for the next block.
  waitForChainLock = (network: Network, minHeight: number, timeoutMs: number): Promise<number | null> => {
    const seen = this.chainlockedHeights.get(network) ?? 0
    if (seen >= minHeight) return Promise.resolve(seen)

    return new Promise<number | null>(resolve => {
      const waiter = {network, minHeight, notify: (height: number): void => {
        clearTimeout(timer)
        resolve(height)
      }}
      const timer = setTimeout(() => {
        this.chainLockWaiters.delete(waiter)
        resolve(null)
      }, timeoutMs)
      timer.unref?.()
      this.chainLockWaiters.add(waiter)
    })
  }

  isSyncedFor(walletId: string): boolean {
    return this.status.phase === 'synced' && this.status.walletId === walletId
  }

  // One queue for all cursor and block writes: cursorAdvanced lands right
  // after the scan's last blockApplied, and overtaking an in-flight or
  // retrying write would move the resume marker past data that never landed.
  // Returns the task's own settlement so a caller can order on it; the queue
  // tail swallows the rejection either way.
  private enqueuePersist(task: () => Promise<void>): Promise<void> {
    const run = this.persistQueue.catch(() => undefined).then(task)
    this.persistQueue = run.catch(err => console.error('[walletSync] persist task failed:', err))
    return run
  }

  private persistAppliedBlock = (block: AppliedBlock): void => {
    this.enqueuePersist(() => this.writeAppliedBlock(block))
  }

  private async writeAppliedBlock(block: AppliedBlock): Promise<void> {
    for (let attempt = 0; attempt < PERSIST_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, PERSIST_RETRY_MS))
      try {
        const advanceCursor = this.cursorGate.allowsBlockCursor(block.walletId, block.height)
        await this.transactionDAO.applyBlock(block, {advanceCursor})
        this.cursorGate.succeed(block.walletId, block.height)
        if (!this.cursorGate.hasFailures()) this.persistenceError = null
        if (block.txs.length > 0) this.notifyWalletActivity(block.walletId)
        return
      } catch (err) {
        if (attempt < PERSIST_ATTEMPTS - 1) continue
        this.cursorGate.fail(block.walletId, block.height)
        const message = err instanceof Error ? err.message : String(err)
        const heldAt = this.cursorGate.lowestFailed(block.walletId)! - 1
        this.persistenceError =
          `Block ${block.height} could not be saved (${message}). Sync is held at height ${heldAt} ` +
          'and will rescan from there on the next start.'
        console.error(`[walletSync] applyBlock failed permanently at h=${block.height}:`, err)
      }
    }
  }

  // Never past the lowest height whose write failed: everything the cursor
  // passes is skipped by the next scan.
  private async advanceCursorGated(walletId: string, height: number): Promise<void> {
    const target = this.cursorGate.allowedHeight(walletId, height)
    if (target == null) return
    await this.transactionDAO.advanceCursor(walletId, target).catch(err =>
      console.error('[walletSync] advanceCursor failed:', err)
    )
  }

  private notifyWalletActivity(walletId: string): void {
    if (this.onWalletActivity == null || this.activityDebounce != null) return
    this.activityDebounce = setTimeout(() => {
      this.activityDebounce = null
      this.onWalletActivity?.(walletId)
    }, 3_000)
    this.activityDebounce.unref?.()
  }

  hasSyncProgress = async (walletId: string): Promise<boolean> => {
    const cursor = await this.transactionDAO.getCursor(walletId)
    return cursor !== null
  }

  // The only way a locally-signed transaction reaches the network, in both
  // connection modes: it goes over the lock pool, which is also the only pool
  // that can hear the resulting isdlock. Defaults come from
  // p2p/constants.BROADCAST_POLICY; `policy` overrides the lock knobs.
  broadcastTransaction = async (txHex: string, policy?: BroadcastPolicyOverrides): Promise<BroadcastResult> => {
    // Re-forks the utility process if it died since the last send.
    if (this.lockListenNetwork) this.startLockListen(this.lockListenNetwork)
    if (!this.child) {
      throw new Error('broadcastTransaction: p2p transport not started — no wallet selected')
    }
    const requestId = randomUUID()
    const txid = txidFromHex(txHex)
    if (txid) this.watchForInstantLock(txid)
    const result = await new Promise<BroadcastResult>((resolve, reject) => {
      this.pendingBroadcasts.set(requestId, ({ok, result, errorMessage}) => {
        if (ok) {
          resolve(result)
        } else {
          console.error(`[walletSync] broadcast rejected ${txid ?? '(unparsed)'}: ${errorMessage}`)
          const err = new Error(errorMessage ?? 'broadcastTransaction failed') as Error & {result: BroadcastResult}
          err.result = result
          reject(err)
        }
      })
      this.send({type: 'broadcast', requestId, txHex, policy})
    })

    // A lock observed inside the session reaches the cache here; the watcher's
    // txInstantLocked event is the other path and either may land first.
    if (result.islockHex) this.recordInstantLock(result.txid, result.islockHex)

    // Recorded optimistically so the UTXO set reflects the spend immediately;
    // the cfilter scan reconciles it on confirmation. Best-effort — a record
    // failure must not turn a successful broadcast into an error.
    if (this.activeWalletId && result.peersDelivered.length > 0) {
      await this.recordOptimisticSpend(this.activeWalletId, txHex).catch(err =>
        console.error('[walletSync] recordOptimisticSpend failed:', err))
    }
    return result
  }

  // ── pending-tx upkeep ──────────────────────────────────────────────────────

  private startRebroadcastLoop(): void {
    if (this.rebroadcastTimer) return
    this.rebroadcastTimer = setInterval(() => {
      this.rebroadcastPending().catch(err =>
        console.error('[walletSync] rebroadcastPending failed:', err))
    }, REBROADCAST_INTERVAL_MS)
    this.rebroadcastTimer.unref?.()
  }

  private stopRebroadcastLoop(): void {
    if (!this.rebroadcastTimer) return
    clearInterval(this.rebroadcastTimer)
    this.rebroadcastTimer = null
  }

  // Guards against poor propagation and mempool eviction silently dropping a tx
  // while it waits for a block. Instant-locked txs are final and skipped.
  private async rebroadcastPending(): Promise<void> {
    if (!this.activeWalletId || !this.child) return
    const pending = await this.transactionDAO.getPendingTxs(this.activeWalletId)
    for (const p of pending) {
      if (p.instantLocked || !p.isLocal) continue
      const hex = Buffer.from(p.raw).toString('hex')
      this.broadcastTransaction(hex).catch(() => { /* best-effort re-push */ })
    }
    await this.refreshWatchedTxids()
  }

  // Reinstall the worker's isdlock watch set: unconfirmed local txs from SQL,
  // plus txids armed directly. Also covers the "all confirmed → stop fetching
  // isdlocks" case, where no broadcast fires above.
  //
  // Armed entries expire: a tx that never got a lock would otherwise keep the
  // worker fetching isdlock objects for the life of the process.
  private async refreshWatchedTxids(): Promise<void> {
    if (!this.child) return
    const cutoff = Date.now() - LOCK_WATCH_TTL_MS
    const txids = new Set<string>()
    for (const [txid, armedAt] of this.armedLockTxids) {
      if (armedAt < cutoff) this.armedLockTxids.delete(txid)
      else txids.add(txid)
    }
    if (this.activeWalletId) {
      const pending = await this.transactionDAO.getPendingTxs(this.activeWalletId)
      for (const p of pending) if (!p.instantLocked) txids.add(p.txid)
    }
    this.send({type: 'watchTxs', mode: 'replace', txids: [...txids]})
  }

  // Records a just-broadcast tx as pending: inputs become spent (dropping out
  // of getUtxos) and outputs including change become spendable, pre-confirmation.
  private async recordOptimisticSpend(walletId: string, txHex: string): Promise<void> {
    const network = this.activeNetwork
    if (!network) return
    let tx: SDKTransaction
    try {
      tx = SDKTransaction.fromHex(txHex)
    } catch (err) {
      console.error('[walletSync] optimistic record: failed to parse tx hex:', err)
      return
    }
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const ours = new Set([...grouped.receiving, ...grouped.change].map(a => a.address))
    const label = network === 'mainnet' ? 'Mainnet' : 'Testnet'
    const applied: AppliedTx = {
      txid: tx.hash(),
      raw: tx.bytes(),
      inputs: tx.inputs.map((input, vin) => ({
        vin,
        prevTxid: input.txId,
        prevVout: input.vOut,
        sequence: input.sequence,
      })),
      outputs: tx.outputs.map((output, vout) => {
        const address = output.getAddress(label) ?? null
        return {
          vout,
          address,
          satoshis: output.satoshis.toString(),
          isMine: address != null && ours.has(address),
        }
      }),
    }
    await this.transactionDAO.recordPendingTx(walletId, applied, true)
  }

  // A payment the lock pool saw in the mempool. Recorded unconfirmed so the
  // balance moves immediately, then armed so its isdlock marks it final.
  private async recordIncomingTx(walletId: string, tx: AppliedTx): Promise<void> {
    await this.transactionDAO.recordPendingTx(walletId, tx, false)
    const received = tx.outputs.filter(o => o.isMine).reduce((sum, o) => sum + BigInt(o.satoshis), 0n)
    console.log(`[walletSync] incoming tx ${tx.txid} recorded unconfirmed (+${received} duffs)`)
    this.watchForInstantLock(tx.txid)
    this.notifyWalletActivity(walletId)
  }

  // Always sourced from SQL — no main-process cache. Returns [] when no
  // wallet is active.
  getUtxos = async (): Promise<WalletSyncUtxo[]> => {
    if (!this.activeWalletId) return []
    return this.transactionDAO.getUtxos(this.activeWalletId)
  }

  resetSync = async (network: 'mainnet' | 'testnet'): Promise<void> => {
    await this.shutdown()
    // Queued writes outlive the child: one still retrying here would land after
    // the wipe, re-creating the cursor at its block's height so the next scan
    // skips everything below it.
    await this.persistQueue
    const chainDbPath = dataPath(ChainStorageFilename, network)
    await rmWithRetry(chainDbPath)
    await this.transactionDAO.resetSyncDataByNetwork(network)
  }

  shutdown = async (): Promise<void> => {
    this.stopLockWatchSweep()
    if (!this.child) return
    const child = this.child
    const exited = new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
    })
    // A hard kill leaves the LevelDB lock held until the OS reaps the process,
    // which can block the next launch's open.
    this.send({ type: 'stop' })
    await this.waitForPhase('stopped', 3000)
    child.kill()
    await exited
    this.child = null
    this.activeWalletId = null
    this.status = {
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
      lastError: null,
      updatedAt: Date.now(),
    }
  }
}

function toWatchAddress(a: Address): WatchAddress {
  return {address: a.address, index: a.index, isChange: a.isChange, isUsed: a.isUsed}
}

function txidFromHex(txHex: string): string | undefined {
  try {
    return SDKTransaction.fromHex(txHex).hash()
  } catch {
    return undefined
  }
}

async function rmWithRetry(target: string, attempts = 6, delayMs = 250): Promise<void> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.promises.rm(target, { recursive: true, force: true })
      return
    } catch (err) {
      lastError = err
      if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  throw lastError
}
