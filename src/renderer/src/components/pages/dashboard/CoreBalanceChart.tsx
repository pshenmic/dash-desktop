import { useMemo } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useWalletBalance } from '@renderer/hooks/useWalletBalance'
import type { CoreBalanceChartProps } from '@renderer/types/DashboardAnalytics'
import { buildCoreBalanceHistory } from '@renderer/utils/dashboardAnalytics'
import ChartCard from './ChartCard'
import DailyChart from './DailyChart'

export default function CoreBalanceChart({ core, days, hidden }: CoreBalanceChartProps): React.JSX.Element {
  const { status } = useAuth()
  const { balance, loading, err } = useWalletBalance(status?.selectedWalletId ?? undefined)
  const history = useMemo(() => buildCoreBalanceHistory(core, days, balance.dash.amount), [core, days, balance.dash.amount])
  const message = hidden ? 'Amounts hidden'
    : loading ? 'Loading balance…'
    : err ? 'Balance unavailable'
    : history === null ? 'Balance history is incomplete' : null

  return (
    <ChartCard title="Core balance" description="Daily closing balance reconstructed from current Core balance and transaction history, including pending transactions · today shows the current balance">
      {message ? <div className="flex h-[227px] items-center justify-center text-center text-xs text-(--chart-muted)" role="status">{message}</div> : <DailyChart days={history!} />}
    </ChartCard>
  )
}
