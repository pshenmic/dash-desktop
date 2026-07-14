import { API } from '@renderer/api'
import { formatCreationDate } from '@renderer/utils/date'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export type WalletTxDto = {
  walletId: string
  txid: string
  address: string
  direction: 1 | -1
  inAmount: bigint
  blockHeight: number | undefined
  size: number
  outAmount: bigint
  transferAmount: bigint
  usdAmount: string
  date: string | Date
  confirmations: number
  status: string
  vin: Array<{ addr?: string; value?: number; valueSat?: number }>
  vout: Array<{ value: string; address?: string }>
}

type UiStatus = 'success' | 'failed' | 'pending'

export type WalletTxItem = {
  id: string
  status: UiStatus
  confirmations: number
  blockHeight: number | undefined
  size: number
  kind?: 'core'
  title: 'Send' | 'Receive'
  subtitleLabel: 'from' | 'to'
  labelValue: string
  amount: bigint
  usdAmount: string
  date: Date
  direction: 'in' | 'out'
  vin: Array<{ addr?: string; value?: number; valueSat?: number }>
  vout: Array<{ value: string; address?: string }>
}

type TransactionGroup = {
  date: string
  transactions: WalletTxItem[]
}

function groupTransactionsByDay(items: WalletTxItem[]) {
  const map = new Map<string, WalletTxItem[]>()
  for (const tx of items) {
    const key = formatCreationDate(tx.date)
    const arr = map.get(key) ?? []
    arr.push(tx)
    map.set(key, arr)
  }
  return Array.from(map.entries()).map(([label, transactions]) => ({ date: label, transactions }))
}

function mapStatus(status: string, confirmations: number): UiStatus {
  if (status === 'Failed' || status === 'Error') return 'failed'
  if (status === 'Locked') return 'success'
  if (confirmations >= 6) return 'success'
  return 'pending'
}

function mapTx(raw: WalletTxDto): WalletTxItem {
  const direction: 'in' | 'out' = raw.direction === 1 ? 'in' : 'out'
  return {
    id: raw.txid,
    status: mapStatus(raw.status, raw.confirmations),
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

const fetchTransactionGroups = (walletId: string): Promise<TransactionGroup[]> =>
  API.getTransactions(walletId)
    .then((raw) => groupTransactionsByDay(((raw ?? []) as WalletTxDto[]).map(mapTx)))

export function useWalletTransactions(walletId: string | undefined) {
  const { data: groups, loading, err } = useAsyncWithCache<TransactionGroup[]>(
    'transactions',
    walletId,
    () => fetchTransactionGroups(walletId!),
    [],
    { errorMessage: 'Failed to load transactions' }
  )
  return { groups, loading, err }
}

export function prefetchTransactions(walletId: string): Promise<void> {
  return prefetchAsyncCache('transactions', walletId, () => fetchTransactionGroups(walletId))
}

export function refreshTransactions(walletId: string): Promise<void> {
  invalidateAsyncCache('transactions', walletId)
  return prefetchTransactions(walletId)
}
