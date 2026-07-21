import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import {
  AddressesIcon,
  CalendarIcon,
  ClockArrowIcon,
  PendingIcon,
  ReceiveIcon,
  SendIcon,
  TokensIcon,
  TransactionsIcon
} from '@renderer/components/dash-ui-kit-enxtended/icons'
import NoResults from '@renderer/components/ui/NoResults'
import { dashboardPage } from '@renderer/constants'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useWalletTransactions, WalletTxItem } from '@renderer/hooks/useWalletTransactions'
import { useAdresses } from '@renderer/hooks/useAdresses'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { useFiat } from '@renderer/hooks/useFiat'
import { computeWalletStats, formatWalletAge } from '@renderer/utils/dashboardStats'
import { davToDashCompact } from '@renderer/utils/balance'
import { formatCreationDate, timePart } from '@renderer/utils/date'
import HeroBalance from './HeroBalance'
import StatCard from './StatCard'
import ActivityChart from './ActivityChart'
import RecentTransactions from './RecentTransactions'
import ShieldedCard from './ShieldedCard'
import IdentitiesCard from './IdentitiesCard'
import NetworkCard from './NetworkCard'

const RECENT_TX_LIMIT = 5

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return (
    <Text size={12} weight={"medium"} color={"brand"} opacity={40} transform={"uppercase"} className={"tracking-[.08em] px-1"}>
      {title}
    </Text>
  )
}

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className={"flex flex-col gap-4"}>
      <div className={"grid grid-cols-2 xl:grid-cols-4 gap-4"}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={"h-27 rounded-3xl animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8"} />
        ))}
      </div>
      <div className={"grid grid-cols-1 xl:grid-cols-2 gap-4"}>
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

interface DashboardContentProps {
  onTransactionClick: (transaction: WalletTxItem) => void
}

export default function DashboardContent({ onTransactionClick }: DashboardContentProps): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined

  const { groups, loading, err } = useWalletTransactions(walletId)
  const { receiving } = useAdresses(walletId)
  const { isBalanceVisible } = useBalanceVisibility()
  const { format: formatFiat, rateReady } = useFiat()

  const transactions = useMemo(() => groups.flatMap((g) => g.transactions), [groups])
  const stats = useMemo(() => computeWalletStats(transactions), [transactions])
  const recentTransactions = useMemo(() => transactions.slice(0, RECENT_TX_LIMIT), [transactions])

  const labels = dashboardPage.stats
  const hideAmounts = !isBalanceVisible
  const hasActivity = stats.txCount > 0
  const usedAddresses = receiving.filter((a) => a.isUsed).length
  const fiatSub = (duffs: bigint): string | undefined => (rateReady ? `~ ${formatFiat(duffs)}` : undefined)

  return (
    <div className={"px-12 pb-8 flex flex-col gap-4 phase-fade-in"}>
      <HeroBalance />

      <SectionHeader title={dashboardPage.sections.services} />
      <div className={"grid grid-cols-1 lg:grid-cols-2 gap-4"}>
        <ShieldedCard />
        <IdentitiesCard />
      </div>
      <NetworkCard />

      {loading && <DashboardSkeleton />}

      {!loading && err && <NoResults noResults={dashboardPage.recent.error} />}

      {!loading && !err && !hasActivity && <EmptyState />}

      {!loading && !err && hasActivity && (
        <>
          <SectionHeader title={dashboardPage.sections.stats} />
          <div className={"grid grid-cols-2 xl:grid-cols-4 gap-4"}>
            <StatCard
              icon={TransactionsIcon}
              iconSize={16}
              label={labels.transactions}
              value={stats.txCount}
              sub={`${stats.receivedCount} received · ${stats.sentCount} sent`}
            />
            <StatCard
              icon={ReceiveIcon}
              iconSize={12}
              label={labels.totalReceived}
              value={`+${davToDashCompact(stats.totalReceived)} Dash`}
              sub={fiatSub(stats.totalReceived)}
              hidden={hideAmounts}
              tone={"green"}
            />
            <StatCard
              icon={SendIcon}
              iconSize={12}
              label={labels.totalSent}
              value={`-${davToDashCompact(stats.totalSent)} Dash`}
              sub={fiatSub(stats.totalSent)}
              hidden={hideAmounts}
              tone={"orange"}
            />
            <StatCard
              icon={TokensIcon}
              iconSize={15}
              label={labels.largestReceived}
              value={`${davToDashCompact(stats.largestReceived)} Dash`}
              sub={fiatSub(stats.largestReceived)}
              hidden={hideAmounts}
            />
            <StatCard
              icon={CalendarIcon}
              iconSize={14}
              label={labels.walletAge}
              value={formatWalletAge(stats.walletAgeDays)}
              sub={stats.firstTxDate ? `since ${formatCreationDate(stats.firstTxDate)}` : undefined}
            />
            <StatCard
              icon={ClockArrowIcon}
              iconSize={14}
              label={labels.lastActivity}
              value={stats.lastTxDate ? formatCreationDate(stats.lastTxDate) : '—'}
              sub={stats.lastTxDate ? `at ${timePart(stats.lastTxDate)}` : undefined}
            />
            <StatCard
              icon={PendingIcon}
              iconSize={14}
              label={labels.pending}
              value={stats.pendingCount}
              sub={stats.pendingCount === 0 ? 'all confirmed' : 'awaiting confirmations'}
              tone={stats.pendingCount > 0 ? 'orange' : 'green'}
            />
            <StatCard
              icon={AddressesIcon}
              iconSize={14}
              label={labels.addressesUsed}
              value={usedAddresses}
              sub={`of ${receiving.length} generated`}
            />
          </div>

          <div className={"grid grid-cols-1 xl:grid-cols-2 gap-4"}>
            <ActivityChart months={stats.monthlyActivity} hidden={hideAmounts} />
            <RecentTransactions
              transactions={recentTransactions}
              onTransactionClick={onTransactionClick}
            />
          </div>
        </>
      )}
    </div>
  )
}
