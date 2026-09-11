import type { GetAddressesResponse, SelectableUtxo, Transaction } from '../api/types'
import { dashToDuffs } from './balance'
import { outpointKey } from './coinControl'

export function localWalletUtxos(
  walletId: string,
  transactions: Transaction[],
  addresses: GetAddressesResponse,
): SelectableUtxo[] {
  const owned = new Set([...addresses.receiving, ...addresses.change]
    .filter(address => address.walletId === walletId)
    .map(address => address.address))
  const utxos = new Map<string, SelectableUtxo>()
  const spent = new Set<string>()
  for (const tx of transactions) {
    if (tx.walletId !== walletId) continue
    for (const output of tx.vout) {
      if (!owned.has(output.address)) continue
      const utxo = {
        txid: tx.txid,
        vout: output.n,
        address: output.address,
        satoshis: dashToDuffs(output.value),
        height: tx.blockHeight,
      }
      const key = outpointKey(utxo)
      if (output.spentTxId) spent.add(key)
      utxos.set(key, utxo)
    }
  }
  return [...utxos.values()].filter(utxo => !spent.has(outpointKey(utxo)))
}
