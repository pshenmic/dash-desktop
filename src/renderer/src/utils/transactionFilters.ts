import { TxDirectionFilter } from '../enums/TxDirectionFilter'
import { TxTypeFilter } from '../enums/TxTypeFilter'

export interface FilterableTx {
  id: string
  direction: 'in' | 'out'
  status: 'success' | 'failed' | 'pending'
  amount: bigint
  vin: Array<{ addr?: string }>
  vout: Array<{ value: string; address?: string }>
}

export interface TxFilter {
  direction: TxDirectionFilter
  type: TxTypeFilter
  search: string
}

export interface TxTotals {
  received: bigint
  sent: bigint
}

export const DEFAULT_TX_FILTER: TxFilter = {
  direction: TxDirectionFilter.All,
  type: TxTypeFilter.All,
  search: '',
}

const DIRECTION_BY_FILTER: Record<Exclude<TxDirectionFilter, TxDirectionFilter.All>, 'in' | 'out'> = {
  [TxDirectionFilter.Received]: 'in',
  [TxDirectionFilter.Sent]: 'out',
}

export function isDefaultTxFilter(filter: TxFilter): boolean {
  return filter.direction === TxDirectionFilter.All && filter.type === TxTypeFilter.All && filter.search.trim() === ''
}

export function txType(tx: Pick<FilterableTx, 'vout'>): TxTypeFilter {
  return tx.vout.some((output) => !output.address) ? TxTypeFilter.AssetLock : TxTypeFilter.Transfer
}

export function matchesTxFilter(tx: FilterableTx, filter: TxFilter): boolean {
  if (filter.direction !== TxDirectionFilter.All && tx.direction !== DIRECTION_BY_FILTER[filter.direction]) {
    return false
  }
  if (filter.type !== TxTypeFilter.All && txType(tx) !== filter.type) {
    return false
  }
  const search = filter.search.trim().toLowerCase()
  if (
    search &&
    !tx.id.toLowerCase().includes(search) &&
    !tx.vin.some((input) => input.addr?.toLowerCase().includes(search)) &&
    !tx.vout.some((output) => output.address?.toLowerCase().includes(search))
  ) {
    return false
  }
  return true
}

export function filterTransactions<T extends FilterableTx>(txs: T[], filter: TxFilter): T[] {
  return txs.filter((tx) => matchesTxFilter(tx, filter))
}

export function filterTransactionGroups<T extends FilterableTx>(
  groups: Array<{ date: string; transactions: T[] }>,
  filter: TxFilter
): Array<{ date: string; transactions: T[] }> {
  return groups
    .map((group) => ({ ...group, transactions: filterTransactions(group.transactions, filter) }))
    .filter((group) => group.transactions.length > 0)
}

export function computeTxTotals(txs: FilterableTx[]): TxTotals {
  const totals: TxTotals = { received: 0n, sent: 0n }
  for (const tx of txs) {
    if (tx.status === 'failed') continue
    if (tx.direction === 'in') totals.received += tx.amount
    else totals.sent += tx.amount
  }
  return totals
}
