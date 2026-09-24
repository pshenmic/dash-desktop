import { useMemo, useState } from 'react'
import { ANALYTICS_PERIODS, DEFAULT_ANALYTICS_PERIOD } from '@renderer/constants/dashboardAnalytics'
import type { AnalyticsPeriod, DashboardAnalyticsProps } from '@renderer/types/DashboardAnalytics'
import { activityDayKey, buildDashboardAnalytics, chartDate } from '@renderer/utils/dashboardAnalytics'
import CoreBalanceChart from './CoreBalanceChart'
import EvoTypesChart from './EvoTypesChart'
import BalanceAllocationChart from './BalanceAllocationChart'
import DashboardHeading from './DashboardHeading'

export default function WalletAnalytics({ core, platform, platformFailed, hidden }: DashboardAnalyticsProps): React.JSX.Element {
  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_ANALYTICS_PERIOD)
  const today = activityDayKey(new Date())
  const data = useMemo(() => buildDashboardAnalytics(core, platform, period), [core, platform, period, today])

  return (
    <section className="@container/analytics flex min-w-0 flex-col gap-2 text-(--chart-text) [--chart-core:#416ce1] [--chart-evo:#8956ce] [--chart-shielded:#248daf] [--chart-text:var(--color-dash-primary-dark-blue)] [--chart-muted:color-mix(in_srgb,var(--chart-text)_62%,transparent)] [--chart-grid:color-mix(in_srgb,var(--chart-text)_12%,transparent)] dark:[--chart-core:#60f6d2] dark:[--chart-evo:#bda0ff] dark:[--chart-shielded:#79bcff] dark:[--chart-text:#fff]" aria-label="Wallet analytics">
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <DashboardHeading as="h2" title={`${chartDate(data.days[0].date, true)} — ${chartDate(data.days.at(-1)!.date, true)} · local time`}>Wallet analytics</DashboardHeading>
        <div className="flex gap-0.5 rounded-[10px] border border-(--chart-grid) p-[3px]" role="group" aria-label="Analytics period">
          {ANALYTICS_PERIODS.map(value => <button key={value} type="button" className="cursor-pointer rounded-[7px] px-2.5 py-[5px] text-[11px] font-semibold text-(--chart-muted) hover:bg-(--chart-grid) hover:text-(--chart-text) aria-pressed:bg-(--chart-core)/13 aria-pressed:text-(--chart-core) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--chart-core)" aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === 'all' ? 'All time' : `${value} days`}</button>)}
        </div>
      </header>
      {platformFailed && <p className="m-0 px-1 text-[11px] text-(--chart-muted)" role="status">Evo history could not be refreshed. Evo counts may be incomplete or out of date.</p>}
      {data.undatedCount > 0 && <p className="m-0 px-1 text-[11px] text-(--chart-muted)">{data.undatedCount} transactions with an unavailable date are excluded from these charts.</p>}
      <div className="grid grid-cols-3 gap-4 @max-[899px]/analytics:grid-cols-1">
        <CoreBalanceChart key={period} core={core} days={data.days} hidden={hidden} />
        <BalanceAllocationChart />
        <EvoTypesChart types={data.types} evoCount={data.evoCount} />
      </div>
    </section>
  )
}
