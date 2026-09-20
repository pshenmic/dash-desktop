import { useMemo } from 'react'
import { Tabs, DateBlock } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { transactionsPage } from '@renderer/constants'
import TransactionCard from './TransactionCard'
import TransactionsFilter from './TransactionsFilter'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import PartialDataNotice from '@renderer/components/ui/PartialDataNotice'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { creditsToDash, davToDashCompact } from '@renderer/utils/balance'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { computeTxTotals, filterTransactionGroups } from '@renderer/utils/transactionFilters'
import { computePlatformTxTotals, filterPlatformTransactions, groupPlatformTransactionsByDay, mapPlatformTransaction } from '@renderer/utils/platformTransactions'
import type { TransactionsListProps } from '@renderer/types/WalletTransaction'

export default function TransactionsList({
  activeTab,
  onTabChange,
  filter,
  onFilterChange,
  platformFilter,
  onPlatformFilterChange,
  onTransactionClick,
  groups,
  platform,
  platformFailed,
  loading,
  err,
}: TransactionsListProps): React.JSX.Element {
  const { filters } = transactionsPage.transactions
  const { isBalanceVisible } = useBalanceVisibility()
  const filteredGroups = useMemo(() => filterTransactionGroups(groups, filter), [groups, filter])
  const totals = useMemo(() => computeTxTotals(filteredGroups.flatMap((group) => group.transactions)), [filteredGroups])
  const filteredPlatform = useMemo(() => filterPlatformTransactions(platform, platformFilter), [platform, platformFilter])
  const platformTotals = useMemo(() => computePlatformTxTotals(filteredPlatform), [filteredPlatform])
  const platformGroups = useMemo(() => groupPlatformTransactionsByDay(filteredPlatform), [filteredPlatform])
  const hasData = activeTab === 'core' ? groups.length > 0 : platform.length > 0
  const receivedTotal = activeTab === 'core' ? davToDashCompact(totals.received) : creditsToDash(platformTotals.increase)
  const sentTotal = activeTab === 'core' ? davToDashCompact(totals.sent) : creditsToDash(platformTotals.decrease)

  const toolbar = hasData && (
    <div className={'absolute right-[.9375rem] top-[.9375rem] z-10 flex items-center gap-4'}>
      <div className={'flex items-center gap-3'}>
        <div className={'flex items-center gap-1.5'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={40}>
            {filters.totals.received}:
          </Text>
          <Text size={12} weight={'medium'} color={'blue-mint'}>
            <SensitiveValue hidden={!isBalanceVisible} size={'compact'} tone={'accent'}>
              +{receivedTotal} Dash
            </SensitiveValue>
          </Text>
        </div>
        <div className={'flex items-center gap-1.5'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={40}>
            {filters.totals.sent}:
          </Text>
          <Text size={12} weight={'medium'} color={'brand'}>
            <SensitiveValue hidden={!isBalanceVisible} size={'compact'}>
              -{sentTotal} Dash
            </SensitiveValue>
          </Text>
        </div>
      </div>
      {activeTab === 'core' ? (
        <TransactionsFilter kind={'core'} filter={filter} onChange={onFilterChange} />
      ) : (
        <TransactionsFilter kind={'platform'} filter={platformFilter} onChange={onPlatformFilterChange} transactions={platform} />
      )}
    </div>
  )

  const tabs = [
    {
      value: 'core',
      label: 'Core',
      content: (
        <div className={'flex flex-col gap-5 mt-5'}>
          <PartialDataNotice />
          {loading && groups.length === 0 && <ListSkeleton rows={3} rowClassName={'h-[4.25rem] rounded-[.875rem]'} />}
          {err && <NoResults noResults={'Failed to load transactions'} />}
          {!loading && !err && groups.length === 0 && <NoResults noResults={'No transactions found'} />}
          {!loading && groups.length > 0 && filteredGroups.length === 0 && <NoResults noResults={filters.noMatch} />}
          {filteredGroups.map((group) => (
            <div key={group.date} className={'flex flex-col gap-[.9375rem]'}>
              <DateBlock timestamp={group.date} format={'dateOnly'} />
              {group.transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  onClick={() => onTransactionClick({ kind: 'core', transaction })}
                  className={'cursor-pointer'}
                >
                  <TransactionCard {...transaction} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ),
    },
    {
      value: 'platform',
      label: 'Platform',
      content: (
        <div className={'flex flex-col gap-5 mt-5'}>
          {platformFailed && (
            <div role={'status'} className={'flex items-center gap-2 px-3 py-1.5 rounded-[.625rem] dash-block-3 self-start'}>
              <span className={'size-1.5 shrink-0 rounded-full bg-dash-orange'} />
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
                Platform history could not be refreshed. Transactions may be missing or out of date.
              </Text>
            </div>
          )}
          {loading && platform.length === 0 && <ListSkeleton rows={3} rowClassName={'h-[4.25rem] rounded-[.875rem]'} />}
          {err && <NoResults noResults={'Failed to load transactions'} />}
          {!loading && !err && platform.length === 0 && (
            <NoResults noResults={platformFailed ? 'Platform history is unavailable' : 'No Platform transactions found'} />
          )}
          {!loading && platform.length > 0 && filteredPlatform.length === 0 && <NoResults noResults={filters.noMatch} />}
          {platformGroups.map((group) => (
            <div key={group.date?.getTime() ?? 'unknown'} className={'flex flex-col gap-[.9375rem]'}>
              {group.date ? <DateBlock timestamp={group.date} format={'dateOnly'} /> : (
                <Text size={12} weight={'medium'} color={'brand'} opacity={40}>Date unavailable</Text>
              )}
              {group.transactions.map((transaction) => (
                <div
                  key={transaction.hash}
                  onClick={() => onTransactionClick({ kind: 'platform', hash: transaction.hash })}
                  className={'cursor-pointer'}
                >
                  <TransactionCard {...mapPlatformTransaction(transaction)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div className={'px-12 pb-8'}>
      <div className={'relative flex flex-col gap-6 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]'}>
        {toolbar}
        <Tabs
          items={tabs}
          value={activeTab}
          onValueChange={(value) => { if (value === 'core' || value === 'platform') onTabChange(value) }}
          size={'xl'}
          triggerClassName={'!text-dash-primary-dark-blue dark:!text-white font-medium tracking-[-0.03em]'}
        />
      </div>
    </div>
  )
}
