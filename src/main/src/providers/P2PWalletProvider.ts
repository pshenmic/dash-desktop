import {Script, utils as sdkUtils} from 'dash-core-sdk'
import {UTXO} from '../types/UTXO'
import {AddressInfo} from '../types/AddressInfo'
import {Transaction} from '../types/Transaction'
import {TransactionDAO} from '../database/TransactionDAO'
import {AddressDAO} from '../database/AddressDAO'
import {CorePrevOutService} from '../services/core/CorePrevOutService'
import {WalletSyncService} from '../services/core/WalletSyncService'
import {WalletProvider} from './WalletProvider'
import {TxLockStatus} from '../types/TxLockStatus'
import {dedupeTransactions} from '../utils/dedupeTransactions'
import {AddressUsage} from '../types/AddressDiscovery'

const {addressToPublicKeyHash} = sdkUtils

// Reads wallet info from the local SQL database populated by SPV cfilter
// sync. Only knows about txs that touched our addresses.
export class P2PWalletProvider implements WalletProvider {
  constructor(
    private readonly transactionDAO: TransactionDAO,
    private readonly walletId: string,
    private readonly walletSyncService: WalletSyncService,
    private readonly addressDAO: AddressDAO,
    private readonly prevOutService: CorePrevOutService,
  ) {}

  async getWalletTransactions(): Promise<Transaction[]> {
    return dedupeTransactions(await this.transactionDAO.getTransactionsByWallet(this.walletId))
  }

  async getAddressInfos(addresses: string[]): Promise<AddressInfo[]> {
    return this.transactionDAO.getAddressInfos(this.walletId, addresses)
  }

  async getWalletBalance(): Promise<bigint> {
    const {receiving, change} = await this.addressDAO.getAddressesByWalletId(this.walletId)
    return this.transactionDAO.getBalanceForAddresses(this.walletId, [...receiving, ...change].map(a => a.address))
  }

  async getBalance(address: string | string[]): Promise<bigint> {
    const addrs = Array.isArray(address) ? address : [address]
    return this.transactionDAO.getBalanceForAddresses(this.walletId, addrs)
  }

  async getTransactionByHash(txId: string): Promise<Transaction> {
    // The list view can live with blank senders until the sweep reaches them;
    // this is the view that cannot.
    await this.prevOutService.resolveTransaction(this.walletId, txId).catch(err =>
      console.warn(`[prevout] on-demand resolution for ${txId} failed:`, err))

    const tx = await this.transactionDAO.getTransactionByTxid(this.walletId, txId)
    if (!tx) throw new Error(`Tx ${txId} not found in p2p store`)
    return tx
  }

  async getWalletUtxos(): Promise<UTXO[]> {
    const {receiving, change} = await this.addressDAO.getAddressesByWalletId(this.walletId)
    const addresses = [...receiving, ...change].map(a => a.address)
    const utxos = await this.transactionDAO.getUtxosByAddresses(this.walletId, addresses)
    return utxos.map(u => ({
      address: u.address,
      txId: u.txid,
      vOut: u.vout,
      satoshis: BigInt(u.satoshis),
      script: this.p2pkhScript(u.address),
    }))
  }

  async getTxLockStatus(txid: string): Promise<TxLockStatus> {
    return this.transactionDAO.getTxLockStatus(this.walletId, txid)
  }

  async ensureReady(): Promise<void> {
    const status = this.walletSyncService.getStatus()
    if (status.phase !== 'synced' || status.walletId !== this.walletId) {
      throw new Error('Wallet sync is not complete — wait for sync to finish before sending')
    }
  }

  async nextUnusedAddress(): Promise<string> {
    const {receiving} = await this.addressDAO.getAddressesByWalletId(this.walletId)
    if (receiving.length === 0) throw new Error('Wallet has no receiving addresses')

    const used = new Set(
      await this.transactionDAO.getUsedAddresses(this.walletId, receiving.map(a => a.address)),
    )

    return (receiving.find(({address}) => !used.has(address)) ?? receiving[receiving.length - 1]).address
  }

  async getUsedAddresses(addresses: string[]): Promise<string[]> {
    return this.transactionDAO.getUsedAddresses(this.walletId, addresses)
  }

  // The local store only knows the addresses already derived into it, so it
  // cannot answer for indexes beyond the current window.
  async scanAddressUsage(): Promise<AddressUsage[] | null> {
    return null
  }

  private p2pkhScript(address: string): Script {
    const s = new Script()
    s.pushOpCode('OP_DUP')
    s.pushOpCode('OP_HASH160')
    s.pushOpCode('OP_PUSHBYTES_20', addressToPublicKeyHash(address))
    s.pushOpCode('OP_EQUALVERIFY')
    s.pushOpCode('OP_CHECKSIG')
    return s
  }
}
