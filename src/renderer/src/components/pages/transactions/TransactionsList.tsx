import { useMemo, useState } from 'react'
import { Tabs, DateBlock } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { transactionsPage } from '@renderer/constants'
import TransactionCard from './TransactionCard'
import TransactionsFilter from './TransactionsFilter'
import { useWalletTransactions, WalletTxItem } from '@renderer/hooks/useWalletTransactions'
import { useAuth } from '@renderer/contexts/AuthContext'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import { davToDashCompact } from '@renderer/utils/balance'
import {
  DEFAULT_TX_FILTER,
  TxFilter,
  computeTxTotals,
  filterTransactionGroups,
} from '@renderer/utils/transactionFilters'

interface TransactionsListProps {
  onTransactionClick?: (transaction: WalletTxItem) => void
}

export default function TransactionsList({ onTransactionClick }: TransactionsListProps = {}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('transactions')
  const [filter, setFilter] = useState<TxFilter>(DEFAULT_TX_FILTER)
  const {
    transactions: { title, filters }
  } = transactionsPage
  const { status } = useAuth()

  const { groups, loading, err } = useWalletTransactions(status?.selectedWalletId ?? undefined)

  const filteredGroups = useMemo(() => filterTransactionGroups(groups, filter), [groups, filter])
  const totals = useMemo(
    () => computeTxTotals(filteredGroups.flatMap((group) => group.transactions)),
    [filteredGroups]
  )

  const tabs = [
    {
      value: 'transactions',
      label: title,
      content: (
        <div className={"flex flex-col gap-5 mt-5"}>
           {loading && (
            <ListSkeleton rows={3} rowClassName="h-[4.25rem] rounded-[.875rem]" />
          )}

          {!loading && err && (
            <NoResults noResults={"Failed to load transactions"} />
          )}

          {!loading && !err && groups.length === 0 && (
            <NoResults noResults={"No transactions found"} />
          )}

          {!loading && !err && groups.length > 0 && filteredGroups.length === 0 && (
            <NoResults noResults={filters.noMatch} />
          )}

          {!loading && !err && filteredGroups.map((group, groupIndex) => (
            <div key={groupIndex} className={"flex flex-col gap-[.9375rem]"}>
              <DateBlock timestamp={group.date} format={"dateOnly"}/>
                {group.transactions.map((transaction, txIndex) => (
                  <div
                    key={`${transaction.id}-${groupIndex}-${txIndex}`}
                    onClick={() => onTransactionClick?.(transaction)}
                    className={"cursor-pointer"}
                  >
                    <TransactionCard {...transaction} />
                  </div>
                ))}
            </div>
          ))}
        </div>
      )
    }
  ]

  return (
    <div className={"px-12 pb-8"}>
      <div className={`
          relative
          flex
          flex-col
          gap-6
          p-[.9375rem]
          rounded-3xl
          dash-card-base
          shadow-[0_0_32px_0_rgba(12,28,51,0.08)]
        `}
      >
        {!loading && !err && groups.length > 0 && (
          <div className={"absolute right-[.9375rem] top-[.9375rem] z-10 flex items-center gap-4"}>
            <div className={"flex items-center gap-3"}>
              <div className={"flex items-center gap-1.5"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={40}>
                  {filters.totals.received}:
                </Text>
                <Text size={12} weight={"medium"} color={"blue-mint"}>
                  +{davToDashCompact(totals.received)} Dash
                </Text>
              </div>
              <div className={"flex items-center gap-1.5"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={40}>
                  {filters.totals.sent}:
                </Text>
                <Text size={12} weight={"medium"} color={"brand"}>
                  -{davToDashCompact(totals.sent)} Dash
                </Text>
              </div>
            </div>
            <TransactionsFilter filter={filter} onChange={setFilter} />
          </div>
        )}
        <Tabs
          items={tabs}
          value={activeTab}
          onValueChange={setActiveTab}
          size={"xl"}
          triggerClassName={"!text-dash-primary-dark-blue dark:!text-white font-medium tracking-[-0.03em]"}
        />
      </div>
    </div>
  )
}
