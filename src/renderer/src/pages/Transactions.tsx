import { useState } from 'react'
import { useWalletTransactions } from '@renderer/hooks/useWalletTransactions'
import TransactionsList from "@renderer/components/pages/transactions/TransactionsList"
import TransactionDetail from "@renderer/components/pages/transactions/TransactionDetail"
import PlatformTransactionDetail from '@renderer/components/pages/transactions/PlatformTransactionDetail'
import { DEFAULT_TX_FILTER, TxFilter } from '@renderer/utils/transactionFilters'
import { useAuth } from '@renderer/contexts/AuthContext'
import { DEFAULT_PLATFORM_TX_FILTER, TRANSACTIONS_REFRESH_MS } from '@renderer/constants/platformTransactions'
import type { PlatformTxFilter, SelectedTransaction, TransactionsTab } from '@renderer/types/WalletTransaction'

export default function TransactionsPage(): React.JSX.Element {
  const { status } = useAuth()
  return <TransactionsContent key={status?.selectedWalletId ?? 'none'} />
}

function TransactionsContent(): React.JSX.Element {
  const { status } = useAuth()
  const history = useWalletTransactions(status?.selectedWalletId ?? undefined, TRANSACTIONS_REFRESH_MS)
  const [activeTab, setActiveTab] = useState<TransactionsTab>('core')
  const [selectedTransaction, setSelectedTransaction] = useState<SelectedTransaction | null>(null)
  const [filter, setFilter] = useState<TxFilter>(DEFAULT_TX_FILTER)
  const [platformFilter, setPlatformFilter] = useState<PlatformTxFilter>(DEFAULT_PLATFORM_TX_FILTER)

  if (selectedTransaction?.kind === 'core') {
    return (
      <div className={"flex flex-col"}>
        <TransactionDetail
          transaction={selectedTransaction.transaction}
          onBack={() => setSelectedTransaction(null)}
        />
      </div>
    )
  }

  const platformTransaction = selectedTransaction?.kind === 'platform'
    ? history.platform.find((transaction) => transaction.hash === selectedTransaction.hash)
    : undefined

  if (platformTransaction) {
    return <PlatformTransactionDetail transaction={platformTransaction} onBack={() => setSelectedTransaction(null)} />
  }

  return (
    <div className={"flex flex-col"}>
      <TransactionsList
        {...history}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filter={filter}
        onFilterChange={setFilter}
        platformFilter={platformFilter}
        onPlatformFilterChange={setPlatformFilter}
        onTransactionClick={setSelectedTransaction}
      />
    </div>
  )
}
