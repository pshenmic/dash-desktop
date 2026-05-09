import {utilityProcess, UtilityProcess} from 'electron'
import path from 'path'
import os from 'os'
import {ChainStorageFilename, HomeFolderName} from '../constants'
import {WalletDAO} from '../database/WalletDAO'
import {AddressDAO} from '../database/AddressDAO'
import {P2PCommand, P2PEvent, WalletSyncStatus, WalletSyncUtxo} from '../../p2p/messages'
import {GENESIS} from '../../p2p/genesis'

// Main-process facade for wallet sync. Forks the p2p utility process,
// translates wallet-domain calls (startSync(walletId), addWatchAddresses,
// getStatus, getUtxos) into the internal P2P protocol, and caches the
// most recent status / UTXO snapshot for synchronous IPC reads.
//
// NOTE: Preferences-based checkpoint plumbing is temporarily detached. The
// checkpoint is hardcoded in startSync below until the wallet sync path
// needs the configurable trust anchor again — at which point pass
// `Preferences` back in via the constructor and read `preferences.chain[network]`.
export class WalletSyncService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
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
    utxoCount: 0,
    totalBalance: '0',
    peerCount: 0,
    filterCapablePeerCount: 0,
    lastError: null,
    updatedAt: Date.now(),
  }
  private activeWalletId: string | null = null
  private utxos: WalletSyncUtxo[] = []

  constructor(walletDAO: WalletDAO, addressDAO: AddressDAO) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
  }

  private ensureChild(): UtilityProcess {
    if (this.child) return this.child

    const scriptPath = path.join(__dirname, 'p2p.js')
    const child = utilityProcess.fork(scriptPath, [], { serviceName: 'p2p' })

    child.on('message', (data: P2PEvent) => {
      if (data.type === 'status') {
        this.status = data.status
      } else if (data.type === 'utxos') {
        this.utxos = data.utxos
      } else if (data.type === 'error') {
        console.log(data)
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
        utxoCount: 0,
        totalBalance: '0',
        peerCount: 0,
        filterCapablePeerCount: 0,
        lastError: null,
        updatedAt: Date.now(),
      }
      this.activeWalletId = null
      this.utxos = []
    })

    this.child = child
    return child
  }

  private send(command: P2PCommand): void {
    this.ensureChild().postMessage(command)
  }

  startSync = async (walletId: string): Promise<WalletSyncStatus> => {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`)
    }
    const network = wallet.network as 'mainnet' | 'testnet'

    if (this.activeWalletId && this.activeWalletId !== walletId) {
      this.send({ type: 'stop' })
    }

    // Per-wallet sync: only this wallet's addresses go into the watch set.
    // chain.db's UTXO and cfcursor keyspaces are scoped by walletId so each
    // wallet keeps its own scan state independent of others.
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const watchAddresses = [...grouped.receiving, ...grouped.change].map(a => a.address)

    this.activeWalletId = walletId
    this.utxos = []
    // TODO: Checkpoints + per-wallet birthday height. For now we anchor at
    // genesis for the wallet's network — header sync resumes from chain.db
    // tip if it's higher.
    const anchor = GENESIS[network]
    this.send({
      type: 'start',
      network,
      walletId,
      chainDbPath: path.join(os.homedir(), HomeFolderName, ChainStorageFilename),
      startHeight: anchor.height,
      startHash: anchor.hash,
      watchAddresses,
      // birthdayHeight is intentionally undefined — defaults to genesis in the
      // utility process. Replace with a per-wallet birthday once the wallet
      // schema captures it.
    })

    return this.status
  }

  stopSync = (): void => {
    if (!this.child) return
    this.send({ type: 'stop' })
    this.activeWalletId = null
    this.utxos = []
  }

  // Hot-add addresses to the live cfilter watch set. No-op when no p2p child
  // is running OR when the active sync is for a different wallet — the
  // utility process gates on walletId match.
  addWatchAddresses = (walletId: string, addresses: string[]): void => {
    if (!this.child || addresses.length === 0) return
    this.send({ type: 'addWatchAddresses', walletId, addresses })
  }

  getStatus = (): WalletSyncStatus => {
    return this.status
  }

  getUtxos = (): WalletSyncUtxo[] => {
    return this.utxos
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
        utxoCount: 0,
        totalBalance: '0',
        peerCount: 0,
        filterCapablePeerCount: 0,
        lastError: null,
        updatedAt: Date.now(),
      }
      this.activeWalletId = null
      this.utxos = []
    }
  }
}