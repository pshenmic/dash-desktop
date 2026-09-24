import { useMemo } from 'react'
import { CalendarIcon, ClockArrowIcon, ReceiveIcon, SendIcon, TokensIcon, TransactionsIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { useFiat } from '@renderer/hooks/useFiat'
import type { StatisticsProps } from '@renderer/types/DashboardStats'
import { davToDashCompact } from '@renderer/utils/balance'
import { computeWalletStats, formatWalletAge } from '@renderer/utils/dashboardStats'
import { buildStatFlows, statShare, summarizeStatActivity } from '@renderer/utils/dashboardStatCharts'
import { formatCreationDate, timePart } from '@renderer/utils/date'
import DashboardHeading from './DashboardHeading'
import StatCard from './StatCard'
import StatVolumeChart from './StatVolumeChart'
import StatFlowAmounts from './StatFlowAmounts'
import StatAddressUsage from './StatAddressUsage'
import './statistics.css'

export default function Statistics({ transactions, platform, platformFailed }: StatisticsProps): React.JSX.Element {
  const { isBalanceVisible } = useBalanceVisibility()
  const { format: formatFiat, rateReady } = useFiat()
  const stats = useMemo(() => computeWalletStats(transactions), [transactions])
  const flows = useMemo(() => buildStatFlows(transactions, platform), [transactions, platform])
  const activity = useMemo(() => summarizeStatActivity(transactions, platform), [transactions, platform])
  const labels = dashboardPage.stats
  const hidden = !isBalanceVisible
  const totalCount = activity.coreCount + activity.evoCount
  const coreShare = statShare(activity.coreCount, totalCount)
  const evoShare = statShare(activity.evoCount, totalCount)
  const fiatSub = (duffs: bigint): string | undefined => rateReady ? `≈ ${formatFiat(duffs)}` : undefined

  return (
    <section className="dashboard-section wallet-statistics" aria-label={dashboardPage.sections.stats}>
      <header className="dashboard-section-header">
        <DashboardHeading as="h2">{dashboardPage.sections.stats}</DashboardHeading>
        <span className="stats-scope">Core & Evo · All-time totals</span>
      </header>
      <div className="stats-primary">
        <StatCard icon={TransactionsIcon} iconSize={16} label={labels.transactions} value={totalCount}
          sub={platformFailed ? 'Evo history incomplete' : `30d: ${activity.core30d} Core · ${activity.evo30d} Evo`}
          footer={<div className="stat-legend">
            <span title={`${stats.receivedCount} received · ${stats.sentCount} sent`}><i className="stat-dot-core" /><strong>{activity.coreCount}</strong> Core</span>
            <span><i className="stat-dot-evo" /><strong>{activity.evoCount}</strong> Evo{platformFailed ? ' (partial)' : ''}</span>
          </div>}>
          <div className="stat-transactions">
            <div className="stat-donut" aria-hidden="true">
              <svg viewBox="0 0 80 80">
                <circle cx={40} cy={40} r={32} pathLength={100} className="stat-donut-track" />
                <circle cx={40} cy={40} r={32} pathLength={100} stroke="var(--stat-brand)"
                  strokeDasharray={`${coreShare} ${100 - coreShare}`} transform="rotate(-90 40 40)" />
                <circle cx={40} cy={40} r={32} pathLength={100} stroke="var(--stat-evo)"
                  strokeDasharray={`${evoShare} ${100 - evoShare}`} strokeDashoffset={-coreShare} transform="rotate(-90 40 40)" />
              </svg>
              <span>Core / Evo</span>
            </div>
          </div>
        </StatCard>
        <StatCard icon={ReceiveIcon} iconSize={12} label={labels.totalReceived} tone="green" value={null}
          body={<StatFlowAmounts flows={flows} direction="received" hidden={hidden} platformFailed={platformFailed} />}>
          <StatVolumeChart flows={flows} direction="received" hidden={hidden} platformFailed={platformFailed} />
        </StatCard>
        <StatCard icon={SendIcon} iconSize={12} label={labels.totalSent} tone="orange" value={null}
          body={<StatFlowAmounts flows={flows} direction="sent" hidden={hidden} platformFailed={platformFailed} />}>
          <StatVolumeChart flows={flows} direction="sent" hidden={hidden} platformFailed={platformFailed} />
        </StatCard>
      </div>
      <div className="stats-secondary">
        <StatCard icon={TokensIcon} iconSize={15} label="Largest Core receive"
          value={<>{davToDashCompact(stats.largestReceived)} <small>DASH</small></>}
          sub={fiatSub(stats.largestReceived)} hidden={hidden} />
        <StatCard icon={CalendarIcon} label={labels.walletAge} value={activity.firstDate ? formatWalletAge(activity.ageDays) : '—'}
          sub={activity.firstDate ? `since ${formatCreationDate(activity.firstDate)}` : 'No dated activity'} />
        <StatCard icon={ClockArrowIcon} label={labels.lastActivity}
          value={activity.lastDate ? formatCreationDate(activity.lastDate) : '—'}
          sub={activity.lastDate ? <><span className={activity.lastSource === 'Evo' ? 'stat-source-evo' : ''}>{activity.lastSource}</span> · {timePart(activity.lastDate)}</> : 'No dated activity'} />
        <StatAddressUsage />
      </div>
    </section>
  )
}
