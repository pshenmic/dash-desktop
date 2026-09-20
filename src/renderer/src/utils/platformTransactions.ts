import type { Network, PlatformTransaction } from '../api/types'
import type { FilterOption, PlatformTransactionGroup, PlatformTxFilter, PlatformTxTotals, TransactionCardItem } from '../types/WalletTransaction'
import { PLATFORM_TX_CARD_STATUSES } from '../constants/platformTransactions'
import { formatCreationDate, timePart } from './date'
import { identityUrl, platformAddressUrl } from './explorer'
import { isValidPlatformAddress } from './platformAddress'
import { isLikelyIdentityId } from './transferMatrix'

export function platformTransactionTitle(type: string): string {
  return type.trim().toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Unknown operation'
}

export function platformTransactionStatus(status: PlatformTransaction['status']): string {
  if (status === 'SUCCESS') return 'Success'
  if (status === 'FAIL') return 'Failed'
  return 'Status unavailable'
}

export function platformTransactionDate(date: Date, includeTime = false): string {
  if (platformTransactionDateValue(date) === null) return 'Date unavailable'
  return includeTime ? `${formatCreationDate(date)} ${timePart(date)}` : formatCreationDate(date)
}

export function platformTransactionDateValue(date: Date): Date | null {
  return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date : null
}

export function mapPlatformTransaction(transaction: PlatformTransaction): TransactionCardItem {
  let direction: TransactionCardItem['direction'] = 'neutral'
  if (transaction.netCredits > 0n) direction = 'in'
  if (transaction.netCredits < 0n) direction = 'out'

  return {
    id: transaction.hash,
    status: PLATFORM_TX_CARD_STATUSES[transaction.status ?? 'unknown'],
    kind: 'platform',
    title: platformTransactionTitle(transaction.type),
    subtitleLabel: transaction.counterparty ? 'Counterparty' : 'Wallet address or identity',
    labelValue: transaction.counterparty ?? transaction.subject ?? 'Unavailable',
    amount: transaction.netCredits < 0n ? -transaction.netCredits : transaction.netCredits,
    date: platformTransactionDateValue(transaction.date),
    direction,
  }
}

export function groupPlatformTransactionsByDay(transactions: PlatformTransaction[]): PlatformTransactionGroup[] {
  const groups = new Map<string, PlatformTransactionGroup>()
  for (const transaction of transactions) {
    const date = platformTransactionDateValue(transaction.date)
    const key = platformTransactionDate(transaction.date)
    const group = groups.get(key) ?? { date, transactions: [] }
    group.transactions.push(transaction)
    groups.set(key, group)
  }
  return Array.from(groups.values())
}

export function filterPlatformTransactions(transactions: PlatformTransaction[], filter: PlatformTxFilter): PlatformTransaction[] {
  const search = filter.search.trim().toLowerCase()
  return transactions.filter((tx) => {
    if (filter.direction === 'increase' && tx.netCredits <= 0n) return false
    if (filter.direction === 'decrease' && tx.netCredits >= 0n) return false
    if (filter.direction === 'unchanged' && tx.netCredits !== 0n) return false
    if (filter.type !== 'all' && tx.type !== filter.type) return false
    if (filter.status !== 'all' && (tx.status ?? 'unknown') !== filter.status) return false
    return !search || [tx.hash, tx.subject, tx.counterparty].some((value) => value?.toLowerCase().includes(search))
  })
}

export function platformTransactionTypeOptions(transactions: PlatformTransaction[]): FilterOption<string>[] {
  return [
    { value: 'all', label: 'All' },
    ...Array.from(new Set(transactions.map((tx) => tx.type))).sort()
      .map((type) => ({ value: type, label: platformTransactionTitle(type) })),
  ]
}

export function computePlatformTxTotals(transactions: PlatformTransaction[]): PlatformTxTotals {
  let increase = 0n
  let decrease = 0n
  for (const tx of transactions) {
    if (tx.netCredits > 0n) increase += tx.netCredits
    else decrease -= tx.netCredits
  }
  return { increase, decrease }
}

export function platformParticipantUrl(value: string, network: Network): string | null {
  if (isValidPlatformAddress(value, network)) return platformAddressUrl(value, network)
  if (isLikelyIdentityId(value)) return identityUrl(value, network)
  return null
}
