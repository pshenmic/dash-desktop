import { useLayoutEffect, useRef, useState } from 'react'
import { useWalletTransactions } from '@renderer/hooks/useWalletTransactions'
import TransactionsList from "@renderer/components/pages/transactions/TransactionsList"
import TransactionDetail from "@renderer/components/pages/transactions/TransactionDetail"
import PlatformTransactionDetail from '@renderer/components/pages/transactions/PlatformTransactionDetail'
import { DEFAULT_TX_FILTER } from '@renderer/constants/transactionFilters'
import { useAuth } from '@renderer/contexts/AuthContext'
import { TRANSACTIONS_REFRESH_MS } from '@renderer/constants/platformTransactions'
import { SCROLL_CONTAINER_ID } from '@renderer/constants/scrollIndicator'
import { TRANSACTIONS_PAGE_SIZE } from '@renderer/constants/transactionsPage'
import type { SelectedTransaction, TxFilter } from '@renderer/types/WalletTransaction'

export default function TransactionsPage(): React.JSX.Element {
  const { status } = useAuth()
  return <TransactionsContent key={status?.selectedWalletId ?? 'none'} />
}

function TransactionsContent(): React.JSX.Element {
  const { status } = useAuth()
  const history = useWalletTransactions(status?.selectedWalletId ?? undefined, TRANSACTIONS_REFRESH_MS)
  const [selectedTransaction, setSelectedTransaction] = useState<SelectedTransaction | null>(null)
  const [filter, setFilter] = useState<TxFilter>(DEFAULT_TX_FILTER)
  const [visibleCount, setVisibleCount] = useState(TRANSACTIONS_PAGE_SIZE)
  const listScrollTop = useRef<number | null>(null)

  useLayoutEffect(() => {
    const container = document.getElementById(SCROLL_CONTAINER_ID)
    if (container === null) return
    if (selectedTransaction !== null) {
      container.scrollTop = 0
      return
    }
    if (listScrollTop.current === null) return
    container.scrollTop = listScrollTop.current
    listScrollTop.current = null
  }, [selectedTransaction])

  const changeFilter = (next: TxFilter): void => {
    setFilter(next)
    setVisibleCount(TRANSACTIONS_PAGE_SIZE)
  }

  const openTransaction = (transaction: SelectedTransaction): void => {
    listScrollTop.current = document.getElementById(SCROLL_CONTAINER_ID)?.scrollTop ?? null
    setSelectedTransaction(transaction)
  }

  if (selectedTransaction?.kind === 'core') {
    const selected = selectedTransaction.transaction
    const transaction = history.groups.flatMap(group => group.transactions)
      .find(candidate => candidate.id === selected.id) ?? selected
    return (
      <div className={"flex flex-col"}>
        <TransactionDetail
          transaction={transaction}
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
        filter={filter}
        onFilterChange={changeFilter}
        onTransactionClick={openTransaction}
        visibleCount={visibleCount}
        onShowMore={() => setVisibleCount(count => count + TRANSACTIONS_PAGE_SIZE)}
      />
    </div>
  )
}
