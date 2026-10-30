import React, { useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import type { StatVolumeChartProps } from '@renderer/types/DashboardStats'
import { DASH_UNIT } from '@renderer/constants/balance'
import { ANALYTICS_CROSSHAIR, ANALYTICS_FOCUS, ANALYTICS_PLACEHOLDER, ANALYTICS_SERIES } from '@renderer/constants/dashboardAnalytics'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import { STAT_CHART_HEIGHT, STAT_CHART_WIDTH, STAT_FLOW_LABELS, STAT_PLOT_HEIGHT } from '@renderer/constants/dashboardStats'
import { POPOVER } from '@renderer/constants/surfaces'
import { analyticsPeriodLabel } from '@renderer/utils/analyticsPeriod'
import { buildStatChartSeries } from '@renderer/utils/dashboardStatCharts'
import { chartDate } from '@renderer/utils/dashboardAnalytics'
import { creditsToDash } from '@renderer/utils/balance'

export default function StatVolumeChart({ flows, direction, hidden, period }: StatVolumeChartProps): React.JSX.Element {
  const [active, setActive] = useState<number | null>(null)
  const days = flows[0]?.days ?? []
  const series = buildStatChartSeries(flows, direction)
  const selected = active === null ? undefined : days[active]
  const cumulative = direction === 'received'
  const periodLabel = analyticsPeriodLabel(period)
  const mode = cumulative ? dashboardPage.stats.cumulative : dashboardPage.stats.daily

  return (
    <div className="mt-auto flex flex-col gap-1.5">
      <Text size={10} weight="medium" color="brand" opacity={50}>{`${periodLabel} · ${mode}`}</Text>
      {hidden ? (
        <div className={`${STAT_PLOT_HEIGHT} ${ANALYTICS_PLACEHOLDER} py-0`}>
          <Text size={12} weight="medium" color="brand" opacity={50}>{dashboardPage.analytics.amountsHidden}</Text>
        </div>
      ) : (
        <div className={`relative ${STAT_PLOT_HEIGHT} rounded-lg ${ANALYTICS_FOCUS}`} tabIndex={0} role="group"
          aria-label={`${cumulative ? 'Cumulative received' : 'Daily sent'} for Core and Evo over ${period === 'all' ? 'all time' : `the last ${period} calendar days`}, on the same ${DASH_UNIT} scale. ${series.map(item => `${STAT_FLOW_LABELS[item.source]} total: ${creditsToDash(item.total)} ${DASH_UNIT}`).join('. ')}. Hover or use left and right arrows to explore amounts.`}
          onPointerLeave={() => setActive(null)} onFocus={() => setActive(days.length - 1)} onBlur={() => setActive(null)}
          onKeyDown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
            event.preventDefault()
            setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? days.length - 1
              : Math.max(0, Math.min(days.length - 1, (index ?? days.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))))
          }}>
          <svg className="block size-full overflow-visible" viewBox={`0 -2 ${STAT_CHART_WIDTH} ${STAT_CHART_HEIGHT + 4}`} preserveAspectRatio="none" aria-hidden="true">
            <path d={`M 0 ${STAT_CHART_HEIGHT} H ${STAT_CHART_WIDTH}`} className="stroke-dash-primary-dark-blue/10 dark:stroke-white/15" vectorEffect="non-scaling-stroke" />
            {[...series].reverse().map(item => (
              <path key={item.source} d={item.path} fill="none" className={ANALYTICS_SERIES[item.source].stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {days.map((day, index) => (
              <rect key={day.date.getTime()} x={index / days.length * STAT_CHART_WIDTH} y={-2}
                width={STAT_CHART_WIDTH / days.length} height={STAT_CHART_HEIGHT + 4} fill="transparent" onPointerEnter={() => setActive(index)} />
            ))}
          </svg>
          {selected && active !== null && (
            <>
              <div className={`pointer-events-none absolute inset-y-0 ${ANALYTICS_CROSSHAIR}`} style={{ left: `${(active + 0.5) / days.length * 100}%` }} />
              <div className={`${POPOVER} pointer-events-none absolute right-0 bottom-[calc(100%+.375rem)] z-2 flex min-w-44 max-w-60 flex-col gap-1 px-3 py-2.5`} role="status">
                <Text size={10} weight="medium" color="brand" opacity={50}>{`${chartDate(selected.date)} · ${mode} · ${DASH_UNIT}`}</Text>
                {series.map(item => (
                  <div key={item.source} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-0.5 w-3 rounded-full ${ANALYTICS_SERIES[item.source].fill}`} aria-hidden="true" />
                      <Text size={10} weight="medium" color="brand">{STAT_FLOW_LABELS[item.source]}</Text>
                    </span>
                    <Text size={12} weight="bold" color="brand" className="tabular-nums"><DashBigNumber>{creditsToDash(item.readings[active])}</DashBigNumber></Text>
                  </div>
                ))}
                <div className="mt-1 flex flex-col gap-1 border-t border-dash-primary-dark-blue/10 pt-1.5 dark:border-white/12">
                  <Text size={10} weight="medium" color="brand" opacity={50}>{`${periodLabel} totals · ${chartDate(days[0].date)} – ${chartDate(days.at(-1)!.date)}`}</Text>
                  {series.map(item => (
                    <div key={item.source} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-0.5 w-3 rounded-full ${ANALYTICS_SERIES[item.source].fill}`} aria-hidden="true" />
                        <Text size={10} weight="medium" color="brand">{STAT_FLOW_LABELS[item.source]}</Text>
                      </span>
                      <Text size={12} weight="bold" color="brand" className="tabular-nums"><DashBigNumber>{creditsToDash(item.total)}</DashBigNumber></Text>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
