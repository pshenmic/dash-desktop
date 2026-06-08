import {Transaction} from '../types/Transaction'

// A single wallet tx can touch several of our own addresses (the inputs it
// spends plus its change output), and transactions are fetched per address —
// so the same txid comes back once per touched address. Collapse to one row
// per txid, keeping the most-confirmed copy, newest first.
export function dedupeTransactions(transactions: Transaction[]): Transaction[] {
  const byTxid = new Map<string, Transaction>()
  for (const tx of transactions) {
    const existing = byTxid.get(tx.txid)
    if (!existing || tx.confirmations > existing.confirmations) {
      byTxid.set(tx.txid, tx)
    }
  }
  return [...byTxid.values()].sort((a, b) => b?.date?.getTime() - a?.date?.getTime())
}
