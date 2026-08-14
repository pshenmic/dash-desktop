import {UTXO} from '../types/UTXO'
import {AddressInfo} from '../types/AddressInfo'
import {Transaction} from '../types/Transaction'
import {TxLockStatus} from '../types/TxLockStatus'

// Read side only: where a wallet's history, balances and UTXOs come from.
// Putting a tx on the network and observing its lock belongs to
// WalletSyncService, which owns the p2p transport in both connection modes.
export interface WalletProvider {
  getTransactions(address: string): Promise<Transaction[]>
  // Both fields come off one lookup, so anything needing either per address
  // goes through here rather than a call per address. Order is preserved.
  getAddressInfos(addresses: string[]): Promise<AddressInfo[]>
  getBalance(address: string | string[]): Promise<bigint>
  getTransactionByHash(txId: string): Promise<Transaction>
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