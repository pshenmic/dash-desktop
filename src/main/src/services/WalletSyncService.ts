import {utilityProcess, UtilityProcess} from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
import {ChainStorageFilename, HomeFolderName} from '../constants'
import {WalletDAO} from '../database/WalletDAO'
import {AddressDAO} from '../database/AddressDAO'
import {TransactionDAO} from '../database/TransactionDAO'
import {P2PCommand, P2PEvent} from '../../p2p/types/messages'
import {BroadcastResult} from '../../p2p/types/broadcast'
import {AppliedTx, WalletSyncStatus, WalletSyncUtxo} from '../../p2p/types/walletSync'
import {randomUUID} from 'crypto'
import {GENESIS} from '../../p2p/constants'
import {QueryStatus} from '../types/QueryStatus'
import {Transaction as SDKTransaction} from 'dash-core-sdk'

// Cap on the per-child output we retain. The tail is attached to broadcast
// errors and logged on exit so a worker crash carries its own cause instead
// of just "code=1".
const CHILD_OUTPUT_TAIL_LIMIT = 8192

// How often we re-push still-unconfirmed local txs to keep them alive in
// peer mempools. Absence of confirmation is never proof of failure (Dash has
// no reject message), so we keep rebroadcasting until a block / lock settles
// the tx rather than timing it out.
const REBROADCAST_INTERVAL_MS = 60_000

// Main-process facade for wallet sync. Forks the p2p utility process,
// translates wallet-domain calls into the internal P2P protocol, and
// persists per-block effects (transactions, outputs, inputs, cfilter
// cursor) through TransactionDAO. The utility process is now strictly
// stateless w.r.t. wallet data — it gets seedUtxos + cfilterCursor in
// the start command and emits blockApplied / cursorAdvanced events back
// for SQL persistence here.
export class WalletSyncService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private transactionDAO: TransactionDAO
  private child: UtilityProcess | null = null
  // Always populated. Before the utility process is forked (and after it
  // exits) we hold a 'stopped' snapshot — same shape the orchestrator emits
  // on teardown — so the renderer never sees null.
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
    phaseEtaMs: null,
    lastError: null,
    updatedAt: Date.now(),
  }
  private activeWalletId: string | null = null
  private activeNetwork: 'mainnet' | 'testnet' | null = null
  // Re-pushes unconfirmed local txs on an interval while a wallet is synced.
  private rebroadcastTimer: ReturnType<typeof setInterval> | null = null
  // Rolling tail of the utility process' stdout+stderr. Captured so a crash
  // surfaces its actual cause (uncaughtException stack, V8 fatal, etc.) to the
  // caller and the main-process log, not just the bare exit code.
  private childOutputTail = ''
  // Outstanding broadcastTransaction calls keyed by requestId. The utility
  // process echoes the requestId back in P2PBroadcastResultMessage so we
  // can resolve the right promise when multiple broadcasts overlap.
  private pendingBroadcasts = new Map<string, (event: {ok: boolean; result: BroadcastResult; errorMessage: string | null}) => void>()

  constructor(walletDAO: WalletDAO, addressDAO: AddressDAO, transactionDAO: TransactionDAO) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.transactionDAO = transactionDAO
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
      process.stdout.write(text)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this.childOutputTail = (this.childOutputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
      process.stderr.write(text)
    })

    child.on('message', (data: P2PEvent) => {
      if (data.type === 'status') {
        this.status = data.status
      } else if (data.type === 'blockApplied') {
        this.transactionDAO.applyBlock(data.block).catch(err =>
          console.error('[walletSync] applyBlock failed:', err)
        )
      } else if (data.type === 'cursorAdvanced') {
        this.transactionDAO.advanceCursor(data.walletId, data.height).catch(err =>
          console.error('[walletSync] advanceCursor failed:', err)
        )
      } else if (data.type === 'broadcastResult') {
        const resolve = this.pendingBroadcasts.get(data.requestId)
        if (resolve) {
          this.pendingBroadcasts.delete(data.requestId)
          resolve({ok: data.ok, result: data.result, errorMessage: data.errorMessage})
        }
      } else if (data.type === 'txInstantLocked') {
        this.transactionDAO.markInstantLocked(data.walletId, data.txid).catch(err =>
          console.error('[walletSync] markInstantLocked failed:', err)
        )
      } else if (data.type === 'chainLocked') {
        this.transactionDAO.markChainlockedUpTo(data.walletId, data.height).catch(err =>
          console.error('[walletSync] markChainlockedUpTo failed:', err)
        )
      } else if (data.type === 'error') {
        console.error('[p2p] utility process error:', data.message)
      }
    })

    child.on('exit', code => {
      const tail = this.childOutputTail.trim()
      console.log(`[p2p] utility process exited code=${code}`)
      if (tail) console.error(`[p2p] last output before exit:\n${tail}`)
      this.child = null
      // Fail any in-flight broadcasts — the utility process can no longer
      // answer them. The pendingBroadcasts entries would otherwise leak
      // and the caller's promise would hang forever. The captured output tail
      // is appended so the crash cause travels with the rejection.
      const crashDetail = tail ? `\n--- p2p output (tail) ---\n${tail}` : ''
      for (const [requestId, resolve] of this.pendingBroadcasts) {
        resolve({
          ok: false,
          result: {
            txid: '', peersInvited: 0, peersAcked: [], peersPropagated: [],
            instantLocked: false, rejections: [], durationMs: 0,
          },
          errorMessage: `p2p utility process exited (code=${code}) before broadcast ${requestId} completed${crashDetail}`,
        })
      }
      this.pendingBroadcasts.clear()
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

  private send(command: P2PCommand): void {
    this.ensureChild().postMessage(command)
  }

  // Poll the locally-cached status until the utility process reports the given
  // phase, or the timeout elapses. Used by shutdown to confirm chain.db closed.
  private async waitForPhase(phase: WalletSyncStatus['phase'], timeoutMs: number): Promise<void> {
    const start = Date.now()
    while (this.status.phase !== phase && Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  // Returns ack only — phase progression streams via getStatus, not the
  // return value. Returning a status snapshot here gave the renderer the
  // stale 'stopped' state because the utility process hadn't yet emitted
  // its 'connecting' update.
  startSync = async (walletId: string): Promise<QueryStatus> => {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (!wallet) {
      return {success: false, errorMessage: `Wallet ${walletId} not found`}
    }
    const network = wallet.network as 'mainnet' | 'testnet'

    if (this.activeWalletId && this.activeWalletId !== walletId) {
      this.send({ type: 'stop' })
    }

    // Per-wallet sync: only this wallet's addresses go into the watch set.
    // SQL holds wallet-scoped state; chain.db holds only network-shared
    // headers + filter chain.
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const watchAddresses = [...grouped.receiving, ...grouped.change].map(a => a.address)

    this.activeWalletId = walletId
    this.activeNetwork = network
    this.startRebroadcastLoop()
    // Seed the worker's in-memory spend-detection map from SQL.
    const seedUtxos = await this.transactionDAO.getUtxos(walletId)
    const cfilterCursor = await this.transactionDAO.getCursor(walletId)

    const chainDbPath = path.join(os.homedir(), HomeFolderName, ChainStorageFilename, network)
    try {
      fs.mkdirSync(chainDbPath, {recursive: true})
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {success: false, errorMessage: `Failed to create chain.db directory: ${message}`}
    }

    this.send({
      type: 'start',
      network,
      walletId,
      chainDbPath,
      watchAddresses,
      seedUtxos,
      cfilterCursor,
      // birthdayHeight is intentionally undefined — defaults to genesis in the
      // utility process. Replace with a per-wallet birthday once the wallet
      // schema captures it.
    })

    return {success: true, errorMessage: null}
  }

  stopSync = (): void => {
    this.stopRebroadcastLoop()
    this.activeNetwork = null
    if (!this.child) return
    this.send({ type: 'stop' })
    this.activeWalletId = null
  }

  // Hot-add of newly created wallet addresses. We rewind the cfilter cursor
  // (in SQL and in the running worker) so historical filters get re-matched
  // against the new addresses. No-op when no p2p child is running OR when
  // the active sync is for a different wallet — utility process gates on
  // walletId match.
  addWatchAddresses = async (walletId: string, addresses: string[]): Promise<void> => {
    if (addresses.length === 0) return
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (!wallet) return
    const network = wallet.network as 'mainnet' | 'testnet'
    const rewindToHeight = GENESIS[network].height
    await this.transactionDAO.resetCursor(walletId, rewindToHeight)
    if (!this.child) return
    this.send({type: 'addWatchAddresses', walletId, addresses, rewindToHeight})
  }

  getStatus = (): WalletSyncStatus => {
    return this.status
  }

  hasSyncProgress = async (walletId: string): Promise<boolean> => {
    const cursor = await this.transactionDAO.getCursor(walletId)
    return cursor !== null
  }

  // Broadcast a signed transaction over the active peer pool. Requires
  // startSync to have been called (the utility process owns the pool).
  // The retry / timeout / ack policy is hardcoded in
  // p2p/constants.BROADCAST_POLICY — callers pass only the tx hex.
  broadcastTransaction = async (txHex: string): Promise<BroadcastResult> => {
    if (!this.child) {
      throw new Error('broadcastTransaction: p2p utility process not started — call startWalletSync first')
    }
    const requestId = randomUUID()
    const result = await new Promise<BroadcastResult>((resolve, reject) => {
      this.pendingBroadcasts.set(requestId, ({ok, result, errorMessage}) => {
        if (ok) {
          resolve(result)
        } else {
          const err = new Error(errorMessage ?? 'broadcastTransaction failed') as Error & {result: BroadcastResult}
          err.result = result
          reject(err)
        }
      })
      this.send({type: 'broadcast', requestId, txHex})
    })

    // The tx reached at least one peer — optimistically record the spend so
    // the UTXO set reflects it immediately. The cfilter scan reconciles it on
    // confirmation; the rebroadcast loop keeps it alive meanwhile. Best-effort:
    // a record failure must not turn a successful broadcast into an error.
    if (this.activeWalletId && (result.peersAcked.length > 0 || result.peersPropagated.length > 0)) {
      await this.recordOptimisticSpend(this.activeWalletId, txHex).catch(err =>
        console.error('[walletSync] recordOptimisticSpend failed:', err))
      await this.pushWatchedTxids().catch(err =>
        console.error('[walletSync] pushWatchedTxids failed:', err))
    }
    return result
  }

  // Manually abandon a stuck unconfirmed tx, freeing its inputs to be respent.
  // The caller accepts the (small) risk the tx still confirms later — there is
  // no way to prove a broadcast tx failed short of a confirmed conflict.
  abandonTransaction = async (walletId: string, txid: string): Promise<void> => {
    await this.transactionDAO.abandonTransaction(walletId, txid)
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

  // Re-push every still-unconfirmed local tx so poor propagation / mempool
  // eviction doesn't silently drop it while it waits for a block. Instant-
  // locked txs are final and skipped.
  private async rebroadcastPending(): Promise<void> {
    if (!this.activeWalletId || !this.child) return
    const pending = await this.transactionDAO.getPendingTxs(this.activeWalletId)
    const watch: string[] = []
    for (const p of pending) {
      if (p.instantLocked) continue
      watch.push(p.txid)
      const hex = Buffer.from(p.raw).toString('hex')
      this.broadcastTransaction(hex).catch(() => { /* best-effort re-push */ })
    }
    // Refresh the worker's isdlock watch set (covers the "all confirmed →
    // stop fetching isdlocks" case, where no broadcast fires above).
    this.send({type: 'watchTxs', walletId: this.activeWalletId, txids: watch})
  }

  // Tell the worker which unconfirmed local txids to watch for an isdlock.
  private async pushWatchedTxids(): Promise<void> {
    if (!this.activeWalletId || !this.child) return
    const pending = await this.transactionDAO.getPendingTxs(this.activeWalletId)
    const txids = pending.filter(p => !p.instantLocked).map(p => p.txid)
    this.send({type: 'watchTxs', walletId: this.activeWalletId, txids})
  }

  // Parse a just-broadcast tx and record it as pending: its inputs become
  // spent (dropping out of getUtxos) and its outputs (incl. change) become
  // spendable, all before confirmation.
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
    await this.transactionDAO.recordPendingBroadcast(walletId, applied)
  }

  // Always sourced from SQL — no main-process cache. Returns [] when no
  // wallet is active.
  getUtxos = async (): Promise<WalletSyncUtxo[]> => {
    if (!this.activeWalletId) return []
    return this.transactionDAO.getUtxos(this.activeWalletId)
  }

  resetSync = async (network: 'mainnet' | 'testnet'): Promise<void> => {
    await this.shutdown()
    const chainDbPath = path.join(os.homedir(), HomeFolderName, ChainStorageFilename, network)
    await rmWithRetry(chainDbPath)
    await this.transactionDAO.resetSyncDataByNetwork(network)
  }

  shutdown = async (): Promise<void> => {
    if (!this.child) return
    const child = this.child
    const exited = new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
    })
    // Ask the utility process to close chain.db (release the LevelDB lock)
    // before we kill it. A hard kill leaves the lock held until the OS reaps
    // the process, which can block the next launch's open.
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
      phaseEtaMs: null,
      lastError: null,
      updatedAt: Date.now(),
    }
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
