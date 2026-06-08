import { useState } from 'react'
import { WalletTxItem } from '@renderer/hooks/useWalletTransactions'
import { useAuth } from '@renderer/contexts/AuthContext'
import TransactionsList from "@renderer/components/pages/transactions/TransactionsList"
import TransactionDetail from "@renderer/components/pages/transactions/TransactionDetail"

export default function TransactionsPage(): React.JSX.Element {
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTxItem | null>(null)
  const { status } = useAuth()

  if (selectedTransaction) {
    return (
      <div className={"flex flex-col"}>
        <TransactionDetail
          transaction={selectedTransaction}
          network={status?.network ?? null}
          onBack={() => setSelectedTransaction(null)}
        />
      </div>
    )
  }

  return (
    <div className={"flex flex-col"}>
      <TransactionsList onTransactionClick={setSelectedTransaction} />
    </div>
  )
}
