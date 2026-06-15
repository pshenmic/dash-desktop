import { useState } from 'react'
import { WalletTxItem } from '@renderer/hooks/useWalletTransactions'
import DashboardContent from '@renderer/components/pages/dashboard/Page'
import TransactionDetail from '@renderer/components/pages/transactions/TransactionDetail'

export default function DashboardPage(): React.JSX.Element {
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTxItem | null>(null)

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
      <DashboardContent onTransactionClick={setSelectedTransaction} />
    </div>
  )
}
