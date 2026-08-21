import {UTXO} from '../types/UTXO'
import {AddressInfo} from '../types/AddressInfo'
import {Transaction} from '../types/Transaction'
import {TxLockStatus} from '../types/TxLockStatus'
import {AddressUsage} from '../types/AddressDiscovery'
import {ConnectionStatus} from '../types/ConnectionStatus'

// Read side only: where a wallet's history, balances and UTXOs come from.
// Putting a tx on the network and observing its lock belongs to
// WalletSyncService, which owns the p2p transport in both connection modes.
export interface WalletProvider {
  // One transaction usually touches several owned addresses, so collapsing
  // per-address results is the provider's job rather than every caller's.
  getWalletTransactions(): Promise<Transaction[]>
  // Both fields come off one lookup, so anything needing either per address
  // goes through here rather than a call per address. Order is preserved.
  getAddressInfos(addresses: string[]): Promise<AddressInfo[]>
  getWalletBalance(): Promise<bigint>
  getBalance(address: string | string[]): Promise<bigint>
  getTransactionByHash(txId: string): Promise<Transaction>
  // The source decides the address set, not the caller.
  getWalletUtxos(): Promise<UTXO[]>
  getTxLockStatus(txid: string): Promise<TxLockStatus>
  ensureReady(): Promise<void>
  getConnectionStatus(): Promise<ConnectionStatus>
  // "Unused" is whatever the provider's own source of truth says: chain state
  // over the API, or the local SPV store.
  nextUnusedAddress(): Promise<string>
  getUsedAddresses(addresses: string[]): Promise<string[]>
  // Null means the source cannot run the gap walk itself, and the caller has to
  // widen the window round by round through getUsedAddresses.
  scanAddressUsage(gapLimit: number): Promise<AddressUsage[] | null>
}
