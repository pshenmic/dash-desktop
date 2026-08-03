import {Block} from 'dash-core-sdk'
import {UTXO} from '../types/UTXO'
import {Transaction} from '../types/Transaction'
import {TxLockStatus} from '../types/TxLockStatus'

// Read side only: where a wallet's history, balances and UTXOs come from.
// Putting a tx on the network and observing its lock belongs to
// WalletSyncService, which owns the p2p transport in both connection modes.
export interface WalletProvider {
  getTransactions(address: string): Promise<Transaction[]>
  getTransactionCount(address: string): Promise<number>
  getBalance(address: string | string[]): Promise<bigint>
  getTransactionByHash(txId: string): Promise<Transaction>
  getBlockByHash(hash: string): Promise<Block>
  getUTXOs(address: string | string[]): Promise<UTXO[]>
  getTxLockStatus(txid: string): Promise<TxLockStatus>
  ensureReady(): Promise<void>
  // Returns the next unused receiving address for the wallet — used by the
  // Receive tab and change-output selection. The provider decides what
  // "unused" means against its source of truth (chain state via API,
  // local SPV-synced DB, etc.).
  nextUnusedAddress(): Promise<string>
  getUsedAddresses(addresses: string[]): Promise<string[]>
}