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
  ensureReady(): Promise<void>
  // Returns the next unused receiving address for the wallet — used by the
  // Receive tab and change-output selection. The provider decides what
  // "unused" means against its source of truth (chain state via API,
  // local SPV-synced DB, etc.). For the first release this is simplified
  // to "the first receiving address"; full chain-history iteration is a
  // follow-up.
  nextUnusedAddress(): Promise<string>
}