import {Block, Transaction as SDKTransaction} from 'dash-core-sdk'
import {UTXO} from '../types/UTXO'
import {Transaction} from '../types/Transaction'

export interface WalletProvider {
  getTransactions(address: string): Promise<Transaction[]>
  getBalance(address: string | string[]): Promise<bigint>
  getTransactionByHash(txId: string): Promise<Transaction>
  getBlockByHash(hash: string): Promise<Block>
  getUTXOs(address: string): Promise<UTXO[]>
  broadcastTx(tx: SDKTransaction): Promise<string>
}