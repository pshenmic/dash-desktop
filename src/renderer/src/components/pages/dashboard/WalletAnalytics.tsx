import { useMemo, useState } from 'react'
import { Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { ANALYTICS_GRID, DEFAULT_ANALYTICS_PERIOD } from '@renderer/constants/dashboardAnalytics'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import type { AnalyticsPeriod, DashboardAnalyticsProps } from '@renderer/types/DashboardAnalytics'
import { analyticsPeriodFromKey, analyticsPeriodKey, analyticsPeriodOptions } from '@renderer/utils/analyticsPeriod'
import { activityDayKey, buildDashboardAnalytics, chartDate } from '@renderer/utils/dashboardAnalytics'
import CoreBalanceChart from './CoreBalanceChart'
import EvoTypesChart from './EvoTypesChart'
import BalanceAllocationChart from './BalanceAllocationChart'
import DashboardHeading from './DashboardHeading'
import Statistics from './Statistics'

export default function WalletAnalytics({ core, platform, platformFailed, hidden }: DashboardAnalyticsProps): React.JSX.Element {
  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_ANALYTICS_PERIOD)
  const today = activityDayKey(new Date())
  const data = useMemo(() => buildDashboardAnalytics(core, platform, period), [core, platform, period, today])
  const labels = dashboardPage.analytics
  const undatedLabel = `${data.undatedCount} ${labels.excluded}`
  const range = `${chartDate(data.days[0].date, true)} — ${chartDate(data.days.at(-1)!.date, true)} · ${labels.localTime}`

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={labels.title}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <DashboardHeading as="h2" title={range}>{labels.title}</DashboardHeading>
          <Text size={12} weight="medium" color="brand" opacity={50}>{range}</Text>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {data.undatedCount > 0 && (
            <Tooltip label={labels.undatedHint}>
              <span role="note" aria-label={`${undatedLabel}: ${labels.undatedHint}`}>
                <CustomBadge text={undatedLabel} variant="muted" />
              </span>
            </Tooltip>
          )}
          <SegmentedControl
            options={analyticsPeriodOptions()}
            value={analyticsPeriodKey(period)}
            onChange={key => setPeriod(analyticsPeriodFromKey(key))}
            ariaLabel={labels.periodAria}
          />
        </div>
      </header>
      <div className="flex min-w-0 flex-col gap-4">
        <div className={ANALYTICS_GRID}>
          <CoreBalanceChart key={period} core={core} days={data.days} hidden={hidden} className="lg:col-span-2 xl:col-span-1" />
          <BalanceAllocationChart />
          <EvoTypesChart types={data.types} evoCount={data.evoCount} />
        </div>
        <Statistics transactions={core} platform={platform} platformFailed={platformFailed} period={period} days={data.days} />
      </div>
    </section>
  )
}
