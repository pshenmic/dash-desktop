import { TransactionCardAmount, TransactionCardItem, WalletTxDto, WalletTxItem, WalletTxStatus } from '@renderer/types/WalletTransaction'
import { formatCreationDate } from './date'
import { creditsToDash, creditsToDuffs, davToDash } from './balance'

export function formatTransactionCardAmount(transaction: Pick<TransactionCardItem, 'amount' | 'kind'>): TransactionCardAmount {
  if (transaction.kind === 'platform') {
    return { value: creditsToDash(transaction.amount), duffs: creditsToDuffs(transaction.amount) }
  }
  return { value: davToDash(transaction.amount), duffs: transaction.amount }
}

export function groupTransactionsByDay(items: WalletTxItem[]) {
  const map = new Map<string, WalletTxItem[]>()
  for (const tx of items) {
    const key = formatCreationDate(tx.date)
    const transactions = map.get(key) ?? []
    transactions.push(tx)
    map.set(key, transactions)
  }
  return Array.from(map, ([date, transactions]) => ({ date, transactions }))
}

function mapWalletTransactionStatus(status: string, confirmations: number): WalletTxStatus {
  if (status === 'Failed' || status === 'Error') return 'failed'
  if (status === 'Locked') return 'success'
  if (confirmations >= 6) return 'success'
  return 'pending'
}

export function mapWalletTransaction(raw: WalletTxDto): WalletTxItem {
  const direction = raw.direction === 1 ? 'in' : 'out'

  return {
    id: raw.txid,
    status: mapWalletTransactionStatus(raw.status, raw.confirmations),
    confirmations: raw.confirmations,
    kind: 'core',
    blockHeight: raw.blockHeight,
    size: raw.size,
    title: direction === 'in' ? 'Receive' : 'Send',
    subtitleLabel: direction === 'in' ? 'from' : 'to',
    labelValue: raw.address,
    amount: raw.transferAmount,
    usdAmount: raw.usdAmount,
    date: new Date(raw.date),
    direction,
    vin: raw.vin,
    vout: raw.vout,
  }
}
