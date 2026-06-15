import { useNavigate } from 'react-router-dom'
import { Text, ArrowIcon } from '@renderer/components/dash-ui-kit-enxtended'
import TransactionCard from '@renderer/components/pages/transactions/TransactionCard'
import { dashboardPage } from '@renderer/constants'
import { WalletTxItem } from '@renderer/hooks/useWalletTransactions'

interface RecentTransactionsProps {
  transactions: WalletTxItem[]
  onTransactionClick: (transaction: WalletTxItem) => void
}

export default function RecentTransactions({
  transactions,
  onTransactionClick
}: RecentTransactionsProps): React.JSX.Element {
  const navigate = useNavigate()
  const { title, viewAll } = dashboardPage.recent

  return (
    <div className={"flex flex-col gap-4 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
      <div className={"flex items-center justify-between"}>
        <Text size={14} weight={"medium"} color={"brand"}>
          {title}
        </Text>
        <button
          onClick={() => navigate('/transactions')}
          className={"group flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity duration-200"}
        >
          <Text size={12} weight={"medium"} color={"blue-mint"}>
            {viewAll}
          </Text>
          <ArrowIcon size={9} className={"dash-text-primary rotate-180 transition-transform duration-200 group-hover:translate-x-0.5"} color={"currentColor"} />
        </button>
      </div>
      <div className={"flex flex-col gap-[.625rem]"}>
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            onClick={() => onTransactionClick(transaction)}
            className={"cursor-pointer"}
          >
            <TransactionCard {...transaction} />
          </div>
        ))}
      </div>
    </div>
  )
}
