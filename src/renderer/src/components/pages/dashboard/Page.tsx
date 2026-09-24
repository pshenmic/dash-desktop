import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ReceiveIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import NoResults from '@renderer/components/ui/NoResults'
import PartialDataNotice from '@renderer/components/ui/PartialDataNotice'
import { dashboardPage, RECENT_TX_LIMIT } from '@renderer/constants'
import type { DashboardContentProps } from '@renderer/types/WalletTransaction'
import { mergeWalletTransactions } from '@renderer/utils/walletTransactions'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import HeroBalance from './HeroBalance'
import Statistics from './Statistics'
import WalletAnalytics from './WalletAnalytics'
import RecentTransactions from './RecentTransactions'
import ShieldedCard from './ShieldedCard'
import IdentitiesCard from './IdentitiesCard'
import NetworkCard from './NetworkCard'
import DashboardHeading from './DashboardHeading'

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className={"flex flex-col gap-4"}>
      <div className={"grid grid-cols-2 xl:grid-cols-4 gap-4"}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={"h-27 rounded-3xl animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8"} />
        ))}
      </div>
      <div className={"grid grid-cols-1 gap-4"}>
        <div className={"h-60 rounded-3xl animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8"} />
        <div className={"h-60 rounded-3xl animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8"} />
      </div>
    </div>
  )
}

function EmptyState(): React.JSX.Element {
  const navigate = useNavigate()
  const { title, subtitle, action } = dashboardPage.empty

  return (
    <div className={"flex flex-col items-center justify-center gap-4 py-16 rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
      <span className={"flex size-12 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12 dash-text-primary"}>
        <ReceiveIcon size={14} color={"currentColor"} />
      </span>
      <div className={"flex flex-col items-center gap-1"}>
        <Text size={16} weight={"bold"} color={"brand"}>
          {title}
        </Text>
        <Text size={12} weight={"medium"} color={"brand"} opacity={40}>
          {subtitle}
        </Text>
      </div>
      <Button colorScheme={"primary"} size={"sm"} className={"min-h-0! py-2! rounded-[.75rem]"} onClick={() => navigate('/receive')}>
        {action}
      </Button>
    </div>
  )
}

export default function DashboardContent({ groups, platform, platformFailed, loading, err, onTransactionClick }: DashboardContentProps): React.JSX.Element {
  const { isBalanceVisible } = useBalanceVisibility()

  const transactions = useMemo(() => groups.flatMap((g) => g.transactions), [groups])
  const recentTransactions = useMemo(
    () => mergeWalletTransactions(transactions, platform).slice(0, RECENT_TX_LIMIT),
    [transactions, platform]
  )

  const hideAmounts = !isBalanceVisible
  const hasActivity = recentTransactions.length > 0

  return (
    <div className={"px-12 pb-8 flex flex-col gap-4 phase-fade-in"}>
      <PartialDataNotice />
      <HeroBalance />

      {platformFailed && (
        <div role="status">
          <Text size={12} color="brand" opacity={50}>
            Platform history could not be refreshed. Transactions may be missing or out of date.
          </Text>
        </div>
      )}
      {loading && <DashboardSkeleton />}
      {!loading && err && <NoResults noResults={dashboardPage.recent.error} />}
      {!loading && !err && !hasActivity && (
        platformFailed
          ? <NoResults noResults="No transactions available. Platform history could not be loaded." />
          : <EmptyState />
      )}
      {!loading && !err && hasActivity && (
        <div className={"flex flex-col gap-4 min-w-0"}>
          <RecentTransactions
            transactions={recentTransactions}
            onTransactionClick={onTransactionClick}
          />
          <WalletAnalytics core={transactions} platform={platform} platformFailed={platformFailed} hidden={hideAmounts} />
        </div>
      )}

      <section className="flex min-w-0 flex-col gap-2" aria-label={dashboardPage.sections.services}>
        <header className="flex flex-wrap items-center justify-between gap-3 px-1"><DashboardHeading as="h2">{dashboardPage.sections.services}</DashboardHeading></header>
        <div className={"grid grid-cols-1 lg:grid-cols-2 gap-4"}>
          <ShieldedCard />
          <IdentitiesCard />
        </div>
      </section>
      <NetworkCard />

      {!loading && !err && hasActivity && (
        <Statistics transactions={transactions} platform={platform} platformFailed={platformFailed} />
      )}
    </div>
  )
}
