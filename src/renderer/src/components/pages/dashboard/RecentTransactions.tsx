import { useNavigate } from 'react-router-dom'
import { Text, ArrowIcon } from '@renderer/components/dash-ui-kit-enxtended'
import TransactionCard from '@renderer/components/pages/transactions/TransactionCard'
import { dashboardPage } from '@renderer/constants'
import type { RecentTransactionsProps } from '@renderer/types/WalletTransaction'
import DashboardHeading from './DashboardHeading'

export default function RecentTransactions({
  transactions,
  onTransactionClick
}: RecentTransactionsProps): React.JSX.Element {
  const navigate = useNavigate()
  const { title, viewAll } = dashboardPage.recent

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={title}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <DashboardHeading as="h2">{title}</DashboardHeading>
        <button
          onClick={() => navigate('/transactions')}
          className={"group flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity duration-200"}
        >
          <Text size={12} weight={"medium"} color={"blue-mint"}>
            {viewAll}
          </Text>
          <ArrowIcon size={9} className={"dash-text-primary rotate-180 transition-transform duration-200 group-hover:translate-x-0.5"} color={"currentColor"} />
        </button>
      </header>
      <div className={"flex flex-col gap-[.625rem] p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
        {transactions.map((transaction) => (
          <div
            key={`${transaction.kind}:${transaction.id}`}
            onClick={() => onTransactionClick(transaction.selection)}
            className={"cursor-pointer"}
          >
            <TransactionCard {...transaction} fullIdentifiers />
          </div>
        ))}
      </div>
    </section>
  )
}
