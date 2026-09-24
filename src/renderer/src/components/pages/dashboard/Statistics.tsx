import { useMemo } from 'react'
import { Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import { CalendarIcon, ClockArrowIcon, ReceiveIcon, SendIcon, TokensIcon, TransactionsIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import type { StatisticsProps } from '@renderer/types/DashboardStats'
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
  const stats = useMemo(() => computeWalletStats(transactions), [transactions])
  const flows = useMemo(() => buildStatFlows(transactions, platform), [transactions, platform])
  const activity = useMemo(() => summarizeStatActivity(transactions, platform), [transactions, platform])
  const labels = dashboardPage.stats
  const hidden = !isBalanceVisible
  const totalCount = activity.coreCount + activity.evoCount
  const coreShare = statShare(activity.coreCount, totalCount)
  const evoShare = statShare(activity.evoCount, totalCount)

  return (
    <section className="dashboard-section wallet-statistics" aria-label={dashboardPage.sections.stats}>
      <header className="dashboard-section-header">
        <DashboardHeading as="h2">{dashboardPage.sections.stats}</DashboardHeading>
        <span className="stats-scope">Core & Evo · All-time totals</span>
      </header>
      <div className="stats-primary">
        <StatCard icon={TransactionsIcon} iconSize={16} label={labels.transactions} value={null}
          body={<div className="stat-transaction-metrics">
            <div>
              <div className="stat-value">{totalCount}</div>
              <div className="stat-sub">All time{platformFailed ? ' · Evo partial' : ''}</div>
            </div>
            <Tooltip label={`${activity.core30d} Core · ${activity.evo30d} Evo${platformFailed ? ' · Evo history incomplete' : ''}`}>
              <div className="stat-transaction-recent" role="group"
                aria-label={`Last 30 days: ${activity.core30d} Core and ${activity.evo30d} Evo transactions${platformFailed ? '. Evo history incomplete' : ''}`}>
                <div className="stat-transaction-recent-value">{activity.core30d + activity.evo30d}</div>
                <div className="stat-sub">Last 30 days</div>
              </div>
            </Tooltip>
          </div>}
          footer={<div className="stat-transaction-breakdown">
            <div className="stat-legend">
              <span title={`${stats.receivedCount} received · ${stats.sentCount} sent`}><i className="stat-dot-core" />Core <strong>{activity.coreCount}</strong></span>
              <span><i className="stat-dot-evo" />Evo{platformFailed ? ' (partial)' : ''} <strong>{activity.evoCount}</strong></span>
            </div>
            <div className="stat-transaction-share" aria-hidden="true">
              <span className="stat-flow-core" style={{ width: `${coreShare}%` }} />
              <span className="stat-flow-evo" style={{ width: `${evoShare}%` }} />
            </div>
          </div>} />
        <StatCard icon={ReceiveIcon} iconSize={12} label={labels.totalReceived} tone="green" value={null}
          body={<StatFlowAmounts flows={flows} metric="received" hidden={hidden} platformFailed={platformFailed} />}>
          <StatVolumeChart flows={flows} direction="received" hidden={hidden} platformFailed={platformFailed} />
        </StatCard>
        <StatCard icon={SendIcon} iconSize={12} label={labels.totalSent} tone="orange" value={null}
          body={<StatFlowAmounts flows={flows} metric="sent" hidden={hidden} platformFailed={platformFailed} />}>
          <StatVolumeChart flows={flows} direction="sent" hidden={hidden} platformFailed={platformFailed} />
        </StatCard>
      </div>
      <div className="stats-secondary">
        <StatCard icon={TokensIcon} iconSize={15} label={labels.largestReceived} value={null}
          body={<div className="stat-largest-values"><StatFlowAmounts flows={flows} metric="largestReceived" hidden={hidden} platformFailed={platformFailed} showFiat={false} /></div>} />
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
