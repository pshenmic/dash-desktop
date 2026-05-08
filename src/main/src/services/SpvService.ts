import {utilityProcess, UtilityProcess} from 'electron'
import path from 'path'
import os from 'os'
import {ChainStorageFilename, HomeFolderName} from '../constants'
import {WalletDAO} from '../database/WalletDAO'
import {AddressDAO} from '../database/AddressDAO'
import {SpvCommand, SpvEvent, SpvStatus, SpvUtxoSummary} from '../../spv/messages'

// NOTE: Preferences-based checkpoint plumbing is temporarily detached. The
// checkpoint is hardcoded in startSync below until the SPV path needs the
// configurable trust anchor again — at which point pass `Preferences` back
// in via the constructor and read `preferences.chain[network]`.
export class SpvService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private child: UtilityProcess | null = null
  private status: SpvStatus | null = null
  private activeWalletId: string | null = null
  private utxos: SpvUtxoSummary[] = []

  constructor(walletDAO: WalletDAO, addressDAO: AddressDAO) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
  }

  private ensureChild(): UtilityProcess {
    if (this.child) return this.child

    const scriptPath = path.join(__dirname, 'spv.js')
    const child = utilityProcess.fork(scriptPath, [], { serviceName: 'spv' })

    child.on('message', (data: SpvEvent) => {
      if (data.type === 'status') {
        this.status = data.status
      } else if (data.type === 'utxos') {
        this.utxos = data.utxos
      } else if (data.type === 'error') {
        console.log(data)
        console.error('[spv] utility process error:', data.message)
      }
    })

    child.on('exit', code => {
      console.log(`[spv] utility process exited code=${code}`)
      this.child = null
      this.status = null
      this.activeWalletId = null
      this.utxos = []
    })

    this.child = child
    return child
  }

  private send(command: SpvCommand): void {
    this.ensureChild().postMessage(command)
  }

  startSync = async (walletId: string): Promise<SpvStatus | null> => {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`)
    }
    const network = wallet.network as 'mainnet' | 'testnet'

    if (this.activeWalletId && this.activeWalletId !== walletId) {
      this.send({ type: 'stop' })
    }

    // Watch every address from every wallet on this network — the chain.db is
    // network-scoped, and matching across wallets means a single scan covers
    // all loaded wallets without re-running for each.
    const watchAddresses = await this.addressDAO.getAllAddressesForNetwork(network)

    this.activeWalletId = walletId
    this.utxos = []
    // TODO: Checkpoints + per-wallet birthday height
    this.send({
      type: 'start',
      network,
      chainDbPath: path.join(os.homedir(), HomeFolderName, ChainStorageFilename),
      startHeight: 1,
      startHash: '0000047d24635e347be3aaaeb66c26be94901a2f962feccd4f95090191f208c1',
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

  // Hot-add addresses to the live cfilter watch set. No-op when no SPV child
  // is running. The utility process filters by network, so callers don't need
  // to gate on the active wallet's network.
  addWatchAddresses = (network: 'mainnet' | 'testnet', addresses: string[]): void => {
    if (!this.child || addresses.length === 0) return
    this.send({ type: 'addWatchAddresses', network, addresses })
  }

  getStatus = (): SpvStatus | null => {
    return this.status
  }

  getUtxos = (): SpvUtxoSummary[] => {
    return this.utxos
  }

  shutdown = (): void => {
    if (this.child) {
      this.child.kill()
      this.child = null
      this.status = null
      this.activeWalletId = null
      this.utxos = []
    }
  }
}