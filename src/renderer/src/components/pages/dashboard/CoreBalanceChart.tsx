import { useMemo } from 'react'
import { DashLogo } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import StatusChip from '@renderer/components/ui/StatusChip'
import { ANALYTICS_PLACEHOLDER, ANALYTICS_PULSE } from '@renderer/constants/dashboardAnalytics'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useWalletBalance } from '@renderer/hooks/useWalletBalance'
import type { CoreBalanceChartProps } from '@renderer/types/DashboardAnalytics'
import { buildCoreBalanceHistory } from '@renderer/utils/dashboardAnalytics'
import ChartCard from './ChartCard'
import DailyChart from './DailyChart'

export default function CoreBalanceChart({ core, days, hidden, className }: CoreBalanceChartProps): React.JSX.Element {
  const { status } = useAuth()
  const { balance, loading, err } = useWalletBalance(status?.selectedWalletId ?? undefined)
  const history = useMemo(() => buildCoreBalanceHistory(core, days, balance.dash.amount), [core, days, balance.dash.amount])
  const labels = dashboardPage.analytics.coreBalance

  return (
    <ChartCard title={labels.title} icon={DashLogo} description={labels.description} className={className}>
      {hidden ? (
        <div className={`${ANALYTICS_PLACEHOLDER} min-h-52`} role="status">
          <Text size={12} weight="medium" color="brand" opacity={50}>{dashboardPage.analytics.amountsHidden}</Text>
        </div>
      ) : loading ? (
        <div className={`${ANALYTICS_PULSE} min-h-52`} role="status">
          <span className="sr-only">{labels.loading}</span>
        </div>
      ) : err || history === null ? (
        <div className={`${ANALYTICS_PLACEHOLDER} min-h-52`}>
          <div>
            <StatusChip>{err ? labels.unavailable : labels.incomplete}</StatusChip>
          </div>
        </div>
      ) : <DailyChart days={history} />}
    </ChartCard>
  )
}
