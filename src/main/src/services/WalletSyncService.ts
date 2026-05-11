import {utilityProcess, UtilityProcess} from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
import {ChainStorageFilename, HomeFolderName} from '../constants'
import {WalletDAO} from '../database/WalletDAO'
import {AddressDAO} from '../database/AddressDAO'
import {TransactionDAO} from '../database/TransactionDAO'
import {P2PCommand, P2PEvent} from '../../p2p/types/messages'
import {WalletSyncStatus, WalletSyncUtxo} from '../../p2p/types/walletSync'
import {GENESIS} from '../../p2p/constants'
import {QueryStatus} from '../types/QueryStatus'

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

  constructor(walletDAO: WalletDAO, addressDAO: AddressDAO, transactionDAO: TransactionDAO) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.transactionDAO = transactionDAO
  }

  private ensureChild(): UtilityProcess {
    if (this.child) return this.child

    const scriptPath = path.join(__dirname, 'p2p.js')
    const child = utilityProcess.fork(scriptPath, [], { serviceName: 'p2p' })

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
      } else if (data.type === 'error') {
        console.error('[p2p] utility process error:', data.message)
      }
    })

    child.on('exit', code => {
      console.log(`[p2p] utility process exited code=${code}`)
      this.child = null
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
      this.activeWalletId = null
    })

    this.child = child
    return child
  }

  private send(command: P2PCommand): void {
    this.ensureChild().postMessage(command)
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
    // Seed the worker's in-memory spend-detection map from SQL.
    const seedUtxos = await this.transactionDAO.getUtxos(walletId)
    const cfilterCursor = await this.transactionDAO.getCursor(walletId)

    this.send({
      type: 'start',
      network,
      walletId,
      chainDbPath: path.join(os.homedir(), HomeFolderName, ChainStorageFilename),
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

  // Always sourced from SQL — no main-process cache. Returns [] when no
  // wallet is active.
  getUtxos = async (): Promise<WalletSyncUtxo[]> => {
    if (!this.activeWalletId) return []
    return this.transactionDAO.getUtxos(this.activeWalletId)
  }

  resetSync = async (): Promise<void> => {
    this.shutdown()
    await this.transactionDAO.resetAllSyncData()
    const chainDbPath = path.join(os.homedir(), HomeFolderName, ChainStorageFilename)
    await fs.promises.rm(chainDbPath, {recursive: true, force: true})
  }
  shutdown = (): void => {
    if (this.child) {
      this.child.kill()
      this.child = null
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
      this.activeWalletId = null
    }
  }
}
