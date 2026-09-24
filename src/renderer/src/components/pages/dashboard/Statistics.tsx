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
    <section className="@container/statistics flex min-w-0 flex-col gap-3 text-(--stat-text) [--stat-text:var(--color-dash-primary-dark-blue)] [--stat-muted:color-mix(in_srgb,var(--stat-text)_62%,transparent)] [--stat-track:color-mix(in_srgb,var(--stat-text)_10%,transparent)] [--stat-received:#16856f] [--stat-sent:#bc650d] [--stat-brand:var(--color-dash-brand)] [--stat-evo:#8956ce] dark:[--stat-text:#fff] dark:[--stat-received:#60e6c5] dark:[--stat-sent:#ffb369] dark:[--stat-brand:var(--color-dash-mint)] dark:[--stat-evo:#c6a5ff]" aria-label={dashboardPage.sections.stats}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <DashboardHeading as="h2">{dashboardPage.sections.stats}</DashboardHeading>
        <span className="text-[11px] text-(--stat-muted)">Core & Evo · All-time totals</span>
      </header>
      <div className="grid grid-cols-3 gap-3 @max-[760px]/statistics:grid-cols-2 @max-[600px]/statistics:grid-cols-1">
        <StatCard icon={TransactionsIcon} iconSize={16} label={labels.transactions} value={null} className="@max-[760px]/statistics:col-span-full"
          body={<div className="grid grid-cols-2 items-baseline gap-4">
            <div>
              <div className="text-[28px] leading-[1.25] font-extrabold tracking-[-0.4px] tabular-nums wrap-anywhere">{totalCount}</div>
              <div className="text-[11px] leading-4 text-(--stat-muted)">All time{platformFailed ? ' · Evo partial' : ''}</div>
            </div>
            <Tooltip label={`${activity.core30d} Core · ${activity.evo30d} Evo${platformFailed ? ' · Evo history incomplete' : ''}`}>
              <div className="text-right" role="group"
                aria-label={`Last 30 days: ${activity.core30d} Core and ${activity.evo30d} Evo transactions${platformFailed ? '. Evo history incomplete' : ''}`}>
                <div className="text-[23px] leading-[1.25] font-bold tracking-[-0.4px] tabular-nums wrap-anywhere">{activity.core30d + activity.evo30d}</div>
                <div className="text-[11px] leading-4 text-(--stat-muted)">Last 30 days</div>
              </div>
            </Tooltip>
          </div>}
          footer={<div className="flex flex-col gap-2.5">
            <div className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-[5px] text-[11px] text-(--stat-muted)">
              <span title={`${stats.receivedCount} received · ${stats.sentCount} sent`}><i className="mr-1.5 inline-block size-1.5 rounded-full bg-(--stat-brand)" />Core <strong className="ml-[5px] text-base font-bold text-(--stat-text) tabular-nums">{activity.coreCount}</strong></span>
              <span><i className="mr-1.5 inline-block size-1.5 rounded-full bg-(--stat-evo)" />Evo{platformFailed ? ' (partial)' : ''} <strong className="ml-[5px] text-base font-bold text-(--stat-text) tabular-nums">{activity.evoCount}</strong></span>
            </div>
            <div className="flex h-[5px] overflow-hidden rounded-[5px] bg-(--stat-track)" aria-hidden="true">
              <span className="h-full bg-(--stat-brand)" style={{ width: `${coreShare}%` }} />
              <span className="h-full bg-(--stat-evo)" style={{ width: `${evoShare}%` }} />
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
      <div className="grid grid-cols-4 gap-3 @max-[760px]/statistics:grid-cols-2 @max-[460px]/statistics:grid-cols-1">
        <StatCard compact icon={TokensIcon} iconSize={15} label={labels.largestReceived} value={null}
          body={<StatFlowAmounts flows={flows} metric="largestReceived" hidden={hidden} platformFailed={platformFailed} showFiat={false} />} />
        <StatCard compact icon={CalendarIcon} label={labels.walletAge} value={activity.firstDate ? formatWalletAge(activity.ageDays) : '—'}
          sub={activity.firstDate ? `since ${formatCreationDate(activity.firstDate)}` : 'No dated activity'} />
        <StatCard compact icon={ClockArrowIcon} label={labels.lastActivity}
          value={activity.lastDate ? formatCreationDate(activity.lastDate) : '—'}
          sub={activity.lastDate ? <><span className={activity.lastSource === 'Evo' ? 'font-semibold text-(--stat-evo)' : ''}>{activity.lastSource}</span> · {timePart(activity.lastDate)}</> : 'No dated activity'} />
        <StatAddressUsage />
      </div>
    </section>
  )
}
