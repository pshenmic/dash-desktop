import { useState } from 'react'
import { Tabs, DateBlock } from 'dash-ui-kit/react'
import { transactionsPage } from '@renderer/constants'
import TransactionCard from './TransactionCard'
import { useWalletTransactions, WalletTxItem } from '@renderer/hooks/useWalletTransactions'
import { useAuth } from '@renderer/contexts/AuthContext'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'

interface TransactionsListProps {
  onTransactionClick?: (transaction: WalletTxItem) => void
}

export default function TransactionsList({ onTransactionClick }: TransactionsListProps = {}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('transactions')
  const {
    transactions: { title }
  } = transactionsPage
  const { status } = useAuth()

  const { groups, loading, err } = useWalletTransactions(status?.selectedWalletId ?? undefined)

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

          {!loading && !err && groups.map((group, groupIndex) => (
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
