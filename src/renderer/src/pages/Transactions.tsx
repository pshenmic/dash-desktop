import { useState } from 'react'
import { WalletTxItem } from '@renderer/hooks/useWalletTransactions'
import TransactionsList from "@renderer/components/pages/transactions/TransactionsList"
import TransactionDetail from "@renderer/components/pages/transactions/TransactionDetail"
import { DEFAULT_TX_FILTER, TxFilter } from '@renderer/utils/transactionFilters'

export default function TransactionsPage(): React.JSX.Element {
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTxItem | null>(null)
  const [filter, setFilter] = useState<TxFilter>(DEFAULT_TX_FILTER)

  if (selectedTransaction) {
    return (
      <div className={"flex flex-col"}>
        <TransactionDetail
          transaction={selectedTransaction}
          onBack={() => setSelectedTransaction(null)}
        />
      </div>
    )
  }

  return (
    <div className={"flex flex-col"}>
      <TransactionsList
        filter={filter}
        onFilterChange={setFilter}
        onTransactionClick={setSelectedTransaction}
      />
    </div>
  )
}
