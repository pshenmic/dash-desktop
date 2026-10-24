import { useMemo } from 'react'
import { Text, Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import { CalendarIcon, ExclamationIcon, ReceiveIcon, SendIcon, TokensIcon, TransactionsIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { ANALYTICS_GRID } from '@renderer/constants/dashboardAnalytics'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { STAT_ACTIVITY_SOURCE_KIND, STAT_SOURCE_KIND } from '@renderer/constants/dashboardStats'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import type { StatisticsProps } from '@renderer/types/DashboardStats'
import { analyticsPeriodLabel } from '@renderer/utils/analyticsPeriod'
import { computeWalletStats, formatWalletAge } from '@renderer/utils/dashboardStats'
import { buildStatFlows, filterStatTransactions, statShare, summarizeStatActivity } from '@renderer/utils/dashboardStatCharts'
import { formatCreationDate, timePart } from '@renderer/utils/date'
import ChartCard from './ChartCard'
import MetricRow from './MetricRow'
import SourceBadge from './SourceBadge'
import SplitBar from './SplitBar'
import StatVolumeChart from './StatVolumeChart'
import StatFlowAmounts from './StatFlowAmounts'
import StatAddressUsage from './StatAddressUsage'

export default function Statistics({ transactions, platform, platformFailed, period, days }: StatisticsProps): React.JSX.Element {
  const { isBalanceVisible } = useBalanceVisibility()
  const selected = useMemo(() => {
    const now = new Date()
    return {
      core: filterStatTransactions(transactions, days[0].date, now),
      evo: filterStatTransactions(platform, days[0].date, now),
    }
  }, [transactions, platform, days])
  const stats = useMemo(() => computeWalletStats(selected.core), [selected])
  const flows = useMemo(() => buildStatFlows(selected.core, selected.evo, days), [selected, days])
  const activity = useMemo(() => summarizeStatActivity(selected.core, selected.evo), [selected])
  const walletActivity = useMemo(() => summarizeStatActivity(transactions, platform), [transactions, platform])
  const labels = dashboardPage.stats
  const hidden = !isBalanceVisible
  const periodLabel = analyticsPeriodLabel(period)
  const totalCount = activity.coreCount + activity.evoCount
  const coreShare = statShare(activity.coreCount, totalCount)
  const evoShare = statShare(activity.evoCount, totalCount)

  return (
    <div className={ANALYTICS_GRID} role="group" aria-label={dashboardPage.sections.stats}>
      <ChartCard title={labels.totalReceived} icon={ReceiveIcon}>
        <StatFlowAmounts flows={flows} metric="received" hidden={hidden} />
        <StatVolumeChart key={period} flows={flows} direction="received" hidden={hidden} period={period} />
      </ChartCard>
      <ChartCard title={labels.totalSent} icon={SendIcon}>
        <StatFlowAmounts flows={flows} metric="sent" hidden={hidden} />
        <StatVolumeChart key={period} flows={flows} direction="sent" hidden={hidden} period={period} />
      </ChartCard>
      <ChartCard title={labels.transactions} icon={TransactionsIcon}>
        <Tooltip label={`${activity.coreCount} Core · ${activity.evoCount} Evo`}>
          <div className="flex flex-col" role="group" aria-label={`${periodLabel}: ${activity.coreCount} Core and ${activity.evoCount} Evo transactions`}>
            <Text as="div" size={20} weight="extrabold" color="brand" className="leading-[140%] wrap-anywhere">{totalCount.toLocaleString('en-US')}</Text>
            <Text as="div" size={12} weight="medium" color="brand" opacity={50} className="leading-[120%]">{periodLabel}</Text>
          </div>
        </Tooltip>
        <div className="mt-auto flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2" title={`${stats.receivedCount} received · ${stats.sentCount} sent`}>
              <SourceBadge kind={STAT_SOURCE_KIND.core} />
              <Text size={16} weight="bold" color="brand" className="leading-[140%]">{activity.coreCount.toLocaleString('en-US')}</Text>
            </div>
            <div className="flex items-center gap-2">
              <SourceBadge kind={STAT_SOURCE_KIND.evo} />
              {platformFailed && (
                <Tooltip label={labels.evoHistoryIncomplete}>
                  <span role="img" aria-label={labels.evoHistoryIncomplete} className="inline-flex size-3 items-center justify-center rounded-full bg-dash-orange/15 text-dash-orange">
                    <ExclamationIcon size={7} color="currentColor" />
                  </span>
                </Tooltip>
              )}
              <Text size={16} weight="bold" color="brand" className="leading-[140%]">{activity.evoCount.toLocaleString('en-US')}</Text>
            </div>
          </div>
          {totalCount > 0
            ? <SplitBar segments={[{ key: 'core', share: coreShare, series: 'core' }, { key: 'evo', share: evoShare, series: 'evo' }]} />
            : <div className="h-2 rounded-full dash-block-5" aria-hidden="true" />}
        </div>
      </ChartCard>
      <ChartCard title={labels.largestReceived} icon={TokensIcon}>
        <StatFlowAmounts flows={flows} metric="largestReceived" hidden={hidden} showFiat={false} />
      </ChartCard>
      <ChartCard title={labels.activity} icon={CalendarIcon}>
        <div className="flex flex-col gap-2">
          <MetricRow
            lead={<Text size={12} weight="medium" color="brand" opacity={50} className="w-24 shrink-0 leading-[120%]">{labels.walletAge}</Text>}
            value={<Text as="div" size={16} weight="bold" color="brand" className="leading-[140%]">{walletActivity.firstDate ? formatWalletAge(walletActivity.ageDays) : '—'}</Text>}
            aside={<Text size={12} weight="medium" color="brand" opacity={50} className="leading-[120%]">{walletActivity.firstDate ? `${labels.since} ${formatCreationDate(walletActivity.firstDate)}` : labels.noDatedActivity}</Text>}
          />
          <MetricRow
            lead={<Text size={12} weight="medium" color="brand" opacity={50} className="w-24 shrink-0 leading-[120%]">{labels.lastActivity}</Text>}
            value={<Text as="div" size={16} weight="bold" color="brand" className="leading-[140%]">{activity.lastDate ? formatCreationDate(activity.lastDate) : '—'}</Text>}
            aside={activity.lastDate && activity.lastSource
              ? (
                <span className="flex items-center gap-1.5">
                  <SourceBadge kind={STAT_ACTIVITY_SOURCE_KIND[activity.lastSource]} />
                  <Text size={12} weight="medium" color="brand" opacity={50} className="leading-[120%]">{`· ${timePart(activity.lastDate)}`}</Text>
                </span>
              )
              : <Text size={12} weight="medium" color="brand" opacity={50} className="leading-[120%]">{labels.noDatedActivity}</Text>}
          />
        </div>
      </ChartCard>
      <StatAddressUsage />
    </div>
  )
}
