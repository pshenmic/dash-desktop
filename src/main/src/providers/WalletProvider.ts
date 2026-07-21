import {Block, Transaction as SDKTransaction} from 'dash-core-sdk'
import {UTXO} from '../types/UTXO'
import {Transaction} from '../types/Transaction'
import {TxLockStatus} from '../types/TxLockStatus'

export interface WalletProvider {
  getTransactions(address: string): Promise<Transaction[]>
  getTransactionCount(address: string): Promise<number>
  getBalance(address: string | string[]): Promise<bigint>
  getTransactionByHash(txId: string): Promise<Transaction>
  getBlockByHash(hash: string): Promise<Block>
  getUTXOs(address: string): Promise<UTXO[]>
  broadcastTx(tx: SDKTransaction): Promise<string>
  getTxLockStatus(txid: string): Promise<TxLockStatus>
  ensureReady(): Promise<void>
  // Returns the next unused receiving address for the wallet — used by the
  // Receive tab and change-output selection. The provider decides what
  // "unused" means against its source of truth (chain state via API,
  // local SPV-synced DB, etc.).
  nextUnusedAddress(): Promise<string>
  getUsedAddresses(addresses: string[]): Promise<string[]>
}