import {Block, Script, Transaction as SDKTransaction, utils as sdkUtils} from 'dash-core-sdk'
import {UTXO} from '../types/UTXO'
import {Transaction} from '../types/Transaction'
import {TransactionDAO} from '../database/TransactionDAO'
import {AddressDAO} from '../database/AddressDAO'
import {WalletSyncService} from '../services/WalletSyncService'
import {WalletProvider} from './WalletProvider'
import {TxLockStatus} from '../types/TxLockStatus'

const {addressToPublicKeyHash} = sdkUtils

// Reads wallet info from the local SQL database populated by SPV cfilter
// sync. Only knows about txs that touched our addresses.
//
// Broadcast is routed natively through the p2p utility process via
// WalletSyncService. Requires walletSync to be running — otherwise
// broadcast rejects with a "p2p utility process not started" error.
// Unsupported (throw):
//   - getBlockByHash
export class P2PWalletProvider implements WalletProvider {
  constructor(
    private readonly transactionDAO: TransactionDAO,
    private readonly walletId: string,
    private readonly walletSyncService: WalletSyncService,
    private readonly addressDAO: AddressDAO,
  ) {}

  async getTransactions(address: string): Promise<Transaction[]> {
    return this.transactionDAO.getTransactionsByAddress(this.walletId, address)
  }

  async getBalance(address: string | string[]): Promise<bigint> {
    const addrs = Array.isArray(address) ? address : [address]
    return this.transactionDAO.getBalanceForAddresses(this.walletId, addrs)
  }

  async getTransactionByHash(txId: string): Promise<Transaction> {
    const tx = await this.transactionDAO.getTransactionByTxid(this.walletId, txId)
    if (!tx) throw new Error(`Tx ${txId} not found in p2p store`)
    return tx
  }

  async getUTXOs(address: string): Promise<UTXO[]> {
    const utxos = await this.transactionDAO.getUtxosByAddress(this.walletId, address)
    return utxos.map(u => ({
      txId: u.txid,
      vOut: u.vout,
      satoshis: BigInt(u.satoshis),
      script: this.p2pkhScript(address),
    }))
  }

  async broadcastTx(tx: SDKTransaction): Promise<string> {
    const result = await this.walletSyncService.broadcastTransaction(tx.hex())
    return result.txid
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

  async getBlockByHash(): Promise<Block> {
    throw new Error('Unimplemented: getBlockByHash is not available in p2p mode')
  }

  async nextUnusedAddress(): Promise<string> {
    const {receiving} = await this.addressDAO.getAddressesByWalletId(this.walletId)
    if (receiving.length === 0) throw new Error('Wallet has no receiving addresses')

    for (const {address} of receiving) {
      const txs = await this.transactionDAO.getTransactionsByAddress(this.walletId, address)
      if (txs.length === 0) return address
    }

    return receiving[receiving.length - 1].address
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
