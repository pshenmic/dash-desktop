import { useMemo } from 'react'
import { DateBlock } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { transactionsPage } from '@renderer/constants'
import TransactionCard from './TransactionCard'
import TransactionsFilter from './TransactionsFilter'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import PartialDataNotice from '@renderer/components/ui/PartialDataNotice'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { creditsToDash } from '@renderer/utils/balance'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { computeTxTotals, filterTransactions } from '@renderer/utils/transactionFilters'
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
  const { title, filters } = transactionsPage.transactions
  const { isBalanceVisible } = useBalanceVisibility()
  const transactions = useMemo(() => mergeWalletTransactions(groups.flatMap((group) => group.transactions), platform), [groups, platform])
  const filtered = useMemo(() => filterTransactions(transactions, filter), [transactions, filter])
  const filteredGroups = useMemo(() => groupWalletHistoryByDay(filtered), [filtered])
  const totals = useMemo(() => computeTxTotals(filtered), [filtered])
  const hasData = transactions.length > 0

  return (
    <div className={'px-12 pb-8'}>
      <div className={'flex flex-col gap-6 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]'}>
        <div className={'flex flex-wrap items-center justify-between gap-4'}>
          <Text size={16} weight={'medium'} color={'brand'}>{title}</Text>
          {hasData && (
            <div className={'flex flex-wrap items-center gap-4'}>
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
        </div>
        <div className={'flex flex-col gap-5'}>
          <PartialDataNotice />
          {platformFailed && (
            <div role={'status'} className={'flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-3 self-start'}>
              <span className={'size-1.5 shrink-0 rounded-full bg-dash-orange'} />
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
                Platform history could not be refreshed. Transactions may be missing or out of date.
              </Text>
            </div>
          )}
          {loading && !hasData && <ListSkeleton rows={3} rowClassName={'h-[4.25rem] rounded-[.875rem]'} />}
          {err && <NoResults noResults={'Failed to load transactions'} />}
          {!loading && !err && !hasData && (
            <NoResults noResults={platformFailed ? 'No transactions available. Platform history could not be loaded.' : 'No transactions found'} />
          )}
          {!loading && hasData && filtered.length === 0 && <NoResults noResults={filters.noMatch} />}
          {filteredGroups.map((group) => (
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
