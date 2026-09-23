import { useMemo, useState } from 'react'
import { ANALYTICS_PERIODS, DEFAULT_ANALYTICS_PERIOD } from '@renderer/constants/dashboardAnalytics'
import type { AnalyticsPeriod, DashboardAnalyticsProps } from '@renderer/types/DashboardAnalytics'
import { activityDayKey, buildDashboardAnalytics, chartDate } from '@renderer/utils/dashboardAnalytics'
import CoreBalanceChart from './CoreBalanceChart'
import EvoTypesChart from './EvoTypesChart'
import BalanceAllocationChart from './BalanceAllocationChart'
import './analytics.css'

export default function WalletAnalytics({ core, platform, platformFailed, hidden }: DashboardAnalyticsProps): React.JSX.Element {
  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_ANALYTICS_PERIOD)
  const today = activityDayKey(new Date())
  const data = useMemo(() => buildDashboardAnalytics(core, platform, period), [core, platform, period, today])

  return (
    <section className="wallet-analytics" aria-label="Wallet analytics">
      <header className="analytics-header">
        <h2 title={`${chartDate(data.days[0].date, true)} — ${chartDate(data.days.at(-1)!.date, true)} · local time`}>Wallet analytics</h2>
        <div className="analytics-periods" role="group" aria-label="Analytics period">
          {ANALYTICS_PERIODS.map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === 'all' ? 'All time' : `${value} days`}</button>)}
        </div>
      </header>
      {platformFailed && <p className="analytics-notice" role="status">Evo history could not be refreshed. Evo counts may be incomplete or out of date.</p>}
      {data.undatedCount > 0 && <p className="analytics-notice">{data.undatedCount} transactions with an unavailable date are excluded from these charts.</p>}
      <div className="analytics-grid">
        <CoreBalanceChart key={period} core={core} days={data.days} hidden={hidden} />
        <BalanceAllocationChart />
        <EvoTypesChart types={data.types} evoCount={data.evoCount} />
      </div>
    </section>
  )
}
