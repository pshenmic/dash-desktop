import { useState } from 'react'
import { useWalletTransactions } from '@renderer/hooks/useWalletTransactions'
import { useAuth } from '@renderer/contexts/AuthContext'
import { TRANSACTIONS_REFRESH_MS } from '@renderer/constants/platformTransactions'
import type { SelectedTransaction } from '@renderer/types/WalletTransaction'
import PlatformTransactionDetail from '@renderer/components/pages/transactions/PlatformTransactionDetail'
import DashboardContent from '@renderer/components/pages/dashboard/Page'
import TransactionDetail from '@renderer/components/pages/transactions/TransactionDetail'

export default function DashboardPage(): React.JSX.Element {
  const { status } = useAuth()
  return <DashboardContentPage key={status?.selectedWalletId ?? 'none'} />
}

function DashboardContentPage(): React.JSX.Element {
  const { status } = useAuth()
  const history = useWalletTransactions(status?.selectedWalletId ?? undefined, TRANSACTIONS_REFRESH_MS)
  const [selectedTransaction, setSelectedTransaction] = useState<SelectedTransaction | null>(null)

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
      <DashboardContent {...history} onTransactionClick={setSelectedTransaction} />
    </div>
  )
}
