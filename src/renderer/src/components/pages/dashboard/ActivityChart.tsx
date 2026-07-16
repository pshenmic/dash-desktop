import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { dashboardPage } from '@renderer/constants'
import { MonthlyActivity } from '@renderer/utils/dashboardStats'
import { davToDashCompact } from '@renderer/utils/balance'

function barHeightPct(value: bigint, max: bigint): number {
  if (value <= 0n || max <= 0n) return 0
  return Math.max(4, Math.round(Number((value * 1000n) / max) / 10))
}

function monthTooltip(month: MonthlyActivity, hidden: boolean): string {
  const head = `${month.label} ${month.year}`
  if (hidden) return `${head}: ${month.count} tx`
  return `${head}: +${davToDashCompact(month.received)} / -${davToDashCompact(month.sent)} DASH · ${month.count} tx`
}

function Bar({ value, max, accent }: { value: bigint; max: bigint; accent: boolean }): React.JSX.Element {
  const pct = barHeightPct(value, max)
  if (pct === 0) {
    return <div className={"w-2.5 h-[.1875rem] rounded-full bg-dash-primary-dark-blue/10 dark:bg-white/10"} />
  }
  return (
    <div
      style={{ height: `${pct}%` }}
      className={`w-2.5 rounded-full transition-[height] duration-300 ease-out ${
        accent ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-dash-primary-dark-blue/25 dark:bg-white/25'
      }`}
    />
  )
}

function LegendDot({ accent, label }: { accent: boolean; label: string }): React.JSX.Element {
  return (
    <span className={"flex items-center gap-1.5"}>
      <span
        className={`size-2 rounded-full ${
          accent ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-dash-primary-dark-blue/25 dark:bg-white/25'
        }`}
      />
      <Text size={10} weight={"medium"} color={"brand"} opacity={50}>
        {label}
      </Text>
    </span>
  )
}

interface ActivityChartProps {
  months: MonthlyActivity[]
  hidden: boolean
}

export default function ActivityChart({ months, hidden }: ActivityChartProps): React.JSX.Element {
  const { title, received, sent, noActivity } = dashboardPage.activity
  const max = months.reduce((acc, m) => {
    const top = m.received > m.sent ? m.received : m.sent
    return top > acc ? top : acc
  }, 0n)

  return (
    <div className={"flex flex-col gap-5 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
      <div className={"flex items-center justify-between"}>
        <Text size={14} weight={"medium"} color={"brand"}>
          {title}
        </Text>
        <div className={"flex items-center gap-4"}>
          <LegendDot accent label={received} />
          <LegendDot accent={false} label={sent} />
        </div>
      </div>

      {max > 0n ? (
        <div className={"flex items-stretch justify-between gap-2 h-44"}>
          {months.map((month) => (
            <div
              key={`${month.label}-${month.year}`}
              title={monthTooltip(month, hidden)}
              className={"flex flex-1 flex-col items-center gap-2 rounded-xl px-1 pt-2 hover:bg-dash-primary-dark-blue/4 dark:hover:bg-white/4 transition-colors duration-200"}
            >
              <div className={"flex flex-1 w-full items-end justify-center gap-1"}>
                <Bar value={month.received} max={max} accent />
                <Bar value={month.sent} max={max} accent={false} />
              </div>
              <Text size={10} weight={"medium"} color={"brand"} opacity={30}>
                {month.label}
              </Text>
            </div>
          ))}
        </div>
      ) : (
        <div className={"flex items-center justify-center h-44"}>
          <Text size={12} color={"brand"} opacity={40}>
            {noActivity}
          </Text>
        </div>
      )}
    </div>
  )
}
