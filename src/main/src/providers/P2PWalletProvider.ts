import {Block, Script, utils as sdkUtils} from 'dash-core-sdk'
import {UTXO} from '../types/UTXO'
import {Transaction} from '../types/Transaction'
import {TransactionDAO} from '../database/TransactionDAO'
import {WalletProvider} from './WalletProvider'

const {addressToPublicKeyHash} = sdkUtils

// Reads wallet info from the local SQL database populated by SPV cfilter
// sync. Only knows about txs that touched our addresses.
//
// Unsupported (throw):
//   - broadcastTx
//   - getBlockByHash
export class P2PWalletProvider implements WalletProvider {
  constructor(
    private readonly transactionDAO: TransactionDAO,
    private readonly walletId: string,
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

  async broadcastTx(): Promise<string> {
    throw new Error('Unimplemented: broadcastTx is not available in p2p mode')
  }

  async getBlockByHash(): Promise<Block> {
    throw new Error('Unimplemented: getBlockByHash is not available in p2p mode')
  }

  async nextUnusedAddress(): Promise<string> {
    throw new Error('Not implemented')
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