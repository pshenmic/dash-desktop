import { useDeferredValue, useMemo } from 'react'
import { DateBlock } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { CloseIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { transactionsPage } from '@renderer/constants'
import { DEFAULT_TX_FILTER } from '@renderer/constants/transactionFilters'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import TransactionCard from './TransactionCard'
import TransactionsFilter from './TransactionsFilter'
import PageHeader from '@renderer/components/ui/PageHeader'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import PartialDataNotice from '@renderer/components/ui/PartialDataNotice'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { creditsToDash } from '@renderer/utils/balance'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { activeTxFilterChips, computeTxTotals, filterTransactions } from '@renderer/utils/transactionFilters'
import { groupWalletHistoryByDay, mergeWalletTransactions } from '@renderer/utils/walletTransactions'
import type { TransactionsListProps } from '@renderer/types/WalletTransaction'

export default function TransactionsList({
  filter,
  onFilterChange,
  onTransactionClick,
  groups,
  platform,
  platformFailed,
  loading,
  err,
}: TransactionsListProps): React.JSX.Element {
  const { filters } = transactionsPage.transactions
  const { isBalanceVisible } = useBalanceVisibility()
  const appliedFilter = useDeferredValue(filter)
  const isFiltering = appliedFilter !== filter
  const transactions = useMemo(() => mergeWalletTransactions(groups.flatMap((group) => group.transactions), platform), [groups, platform])
  const filtered = useMemo(() => filterTransactions(transactions, appliedFilter), [transactions, appliedFilter])
  const filteredGroups = useMemo(() => groupWalletHistoryByDay(filtered), [filtered])
  const totals = useMemo(() => computeTxTotals(filtered), [filtered])
  const hasData = transactions.length > 0
  const showSkeleton = isFiltering || (loading && !hasData)
  const activeFilters = activeTxFilterChips(filter)

  return (
    <div className={'px-12 pb-8'}>
      <PageHeader title={PAGE_HEADERS.transactions.title} subtitle={PAGE_HEADERS.transactions.subtitle} />
      <div className={'flex flex-col gap-6 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]'}>
        {(hasData || activeFilters.length > 0) && (
          <div className={'flex flex-wrap items-center justify-between gap-4'}>
            <div className={'flex flex-wrap items-center gap-3'}>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'medium'} color={'brand'} opacity={40}>
                  {filters.totals.received}:
                </Text>
                <Text size={12} weight={'medium'} color={'blue-mint'}>
                  <SensitiveValue hidden={!isBalanceVisible} size={'compact'} tone={'accent'}>
                    +{creditsToDash(totals.receivedCredits)} Dash
                  </SensitiveValue>
                </Text>
              </div>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'medium'} color={'brand'} opacity={40}>
                  {filters.totals.sent}:
                </Text>
                <Text size={12} weight={'medium'} color={'brand'}>
                  <SensitiveValue hidden={!isBalanceVisible} size={'compact'}>
                    -{creditsToDash(totals.sentCredits)} Dash
                  </SensitiveValue>
                </Text>
              </div>
            </div>
            <TransactionsFilter filter={filter} onChange={onFilterChange} transactions={platform} />
          </div>
        )}
        {activeFilters.length > 0 && (
          <div aria-label={'Active transaction filters'} className={'flex flex-wrap items-center gap-2'}>
            {activeFilters.map(({ field, label }) => (
              <button
                key={field}
                type={'button'}
                onClick={() => onFilterChange({ ...filter, [field]: DEFAULT_TX_FILTER[field] })}
                aria-label={`Remove ${label}`}
                title={label}
                className={'flex min-w-0 items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-accent-5 cursor-pointer hover:opacity-80'}
              >
                <Text size={12} weight={'medium'} color={'brand'} className={'max-w-72 truncate'}>{label}</Text>
                <CloseIcon size={10} className={'shrink-0 dash-text-primary'} />
              </button>
            ))}
            <button
              type={'button'}
              onClick={() => onFilterChange(DEFAULT_TX_FILTER)}
              className={'px-2 py-1.5 cursor-pointer hover:opacity-80'}
            >
              <Text size={12} weight={'medium'} color={'blue-mint'}>Clear all</Text>
            </button>
          </div>
        )}
        <div className="flex flex-col gap-5" aria-busy={showSkeleton}>
          <PartialDataNotice platformFailed={platformFailed} />
          {showSkeleton && <ListSkeleton rows={3} rowClassName={'h-[4.25rem] rounded-[.875rem]'} />}
          {err && <NoResults noResults={'Failed to load transactions'} />}
          {!showSkeleton && !loading && !err && !hasData && <NoResults noResults={'No transactions found'} />}
          {!showSkeleton && !loading && hasData && filtered.length === 0 && <NoResults noResults={filters.noMatch} />}
          {!showSkeleton && filteredGroups.map((group) => (
            <div key={group.date?.getTime() ?? 'unknown'} className={'flex flex-col gap-[.9375rem]'}>
              {group.date ? <DateBlock timestamp={group.date} format={'dateOnly'} /> : (
                <Text size={12} weight={'medium'} color={'brand'} opacity={40}>Date unavailable</Text>
              )}
              {group.transactions.map((transaction) => (
                <div
                  key={`${transaction.kind}:${transaction.id}`}
                  onClick={() => onTransactionClick(transaction.selection)}
                  className={'cursor-pointer'}
                >
                  <TransactionCard {...transaction} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
