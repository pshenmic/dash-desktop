import { useMemo, useState } from 'react'
import { Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { DEFAULT_ANALYTICS_PERIOD } from '@renderer/constants/dashboardAnalytics'
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

  return (
    <section className="@container/analytics flex min-w-0 flex-col gap-2 text-(--chart-text) [--chart-core:#416ce1] [--chart-evo:#8956ce] [--chart-shielded:#248daf] [--chart-text:var(--color-dash-primary-dark-blue)] [--chart-muted:color-mix(in_srgb,var(--chart-text)_62%,transparent)] [--chart-grid:color-mix(in_srgb,var(--chart-text)_12%,transparent)] dark:[--chart-core:#60f6d2] dark:[--chart-evo:#bda0ff] dark:[--chart-shielded:#79bcff] dark:[--chart-text:#fff]" aria-label="Wallet analytics & statistics">
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <DashboardHeading as="h2" title={`${chartDate(data.days[0].date, true)} — ${chartDate(data.days.at(-1)!.date, true)} · local time`}>Wallet analytics & statistics</DashboardHeading>
        <div className="flex items-center gap-2">
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
            ariaLabel="Analytics period"
          />
        </div>
      </header>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid grid-cols-3 gap-4 @max-[899px]/analytics:grid-cols-1">
          <CoreBalanceChart key={period} core={core} days={data.days} hidden={hidden} />
          <BalanceAllocationChart />
          <EvoTypesChart types={data.types} evoCount={data.evoCount} />
        </div>
        <Statistics transactions={core} platform={platform} platformFailed={platformFailed} period={period} days={data.days} />
      </div>
    </section>
  )
}
