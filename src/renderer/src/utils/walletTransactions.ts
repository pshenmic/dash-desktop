import type { PlatformTransaction } from '@renderer/api/types'
import type { TransactionCardAmount, TransactionCardItem, WalletHistoryGroup, WalletHistoryItem, WalletTxDto, WalletTxItem, WalletTxStatus } from '@renderer/types/WalletTransaction'
import { formatCreationDate } from './date'
import { creditsToDash, creditsToDuffs, davToDash } from './balance'
import { mapPlatformTransaction, platformTransactionDateValue } from './platformTransactions'
import { txType } from './transactionFilters'

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

export function mergeWalletTransactions(core: WalletTxItem[], platform: PlatformTransaction[]): WalletHistoryItem[] {
  const transactions: WalletHistoryItem[] = [
    ...core.map<WalletHistoryItem>((tx) => ({
      ...tx,
      kind: 'core',
      date: platformTransactionDateValue(tx.date),
      type: `core:${txType(tx)}`,
      selection: { kind: 'core', transaction: tx },
      searchValues: [tx.id, tx.labelValue, ...tx.vin.map((input) => input.addr), ...tx.vout.map((output) => output.address)],
    })),
    ...platform.map<WalletHistoryItem>((tx) => ({
      ...mapPlatformTransaction(tx),
      kind: 'platform',
      type: `platform:${tx.type}`,
      selection: { kind: 'platform', hash: tx.hash },
      searchValues: [tx.hash, ...tx.sender.map(end => end.source), ...tx.recipient.map(end => end.source)],
    })),
  ]
  return transactions.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
}

export function groupWalletHistoryByDay(transactions: WalletHistoryItem[]): WalletHistoryGroup[] {
  const groups = new Map<string, WalletHistoryGroup>()
  for (const transaction of transactions) {
    const date = transaction.date
    const key = date ? formatCreationDate(date) : 'unknown'
    const group = groups.get(key) ?? { date, transactions: [] }
    group.transactions.push(transaction)
    groups.set(key, group)
  }
  return Array.from(groups.values())
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
