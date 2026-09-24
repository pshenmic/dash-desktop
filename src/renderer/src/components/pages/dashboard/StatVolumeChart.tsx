import React, { useId, useState } from 'react'
import type { StatVolumeChartProps } from '@renderer/types/DashboardStats'
import { STAT_CHART_HEIGHT, STAT_CHART_WIDTH, STAT_FLOW_COLORS, STAT_FLOW_LABELS } from '@renderer/constants/dashboardStats'
import { buildStatChartSeries, formatStatCredits } from '@renderer/utils/dashboardStatCharts'
import { chartDate } from '@renderer/utils/dashboardAnalytics'
import { creditsToDash } from '@renderer/utils/balance'

export default function StatVolumeChart({ flows, direction, hidden, platformFailed = false }: StatVolumeChartProps): React.JSX.Element {
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId()
  const days = flows[0]?.days ?? []
  const series = buildStatChartSeries(flows, direction)
  const selected = active === null ? undefined : days[active]
  const cumulative = direction === 'received'

  if (hidden) return <div className="stat-chart-hidden">Amounts hidden</div>

  return (
    <div className="stat-volume-chart">
      <div className="stat-chart-caption">
        <span>{cumulative ? '30d cumulative' : '30d daily'}</span>
        {platformFailed && <span className="stat-source-evo">Evo partial</span>}
      </div>
      <div className="stat-chart-plot" tabIndex={0} role="group"
        aria-label={`${cumulative ? 'Cumulative received' : 'Daily sent'} for Core and Evo over the last 30 calendar days, on the same DASH scale. ${series.map(item => `${STAT_FLOW_LABELS[item.source]} total: ${creditsToDash(item.total)} DASH`).join('. ')}. ${platformFailed ? 'Evo history is incomplete. ' : ''}Hover or use left and right arrows to explore amounts.`}
        onPointerLeave={() => setActive(null)} onFocus={() => setActive(days.length - 1)} onBlur={() => setActive(null)}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
          event.preventDefault()
          setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? days.length - 1
            : Math.max(0, Math.min(days.length - 1, (index ?? days.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))))
        }}>
        <svg viewBox={`0 -2 ${STAT_CHART_WIDTH} ${STAT_CHART_HEIGHT + 4}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            {series.map(item => (
              <linearGradient key={item.source} id={`${gradientId}-${item.source}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STAT_FLOW_COLORS[item.source]} stopOpacity="0.2" />
                <stop offset="100%" stopColor={STAT_FLOW_COLORS[item.source]} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>
          <path d={`M 0 ${STAT_CHART_HEIGHT} H ${STAT_CHART_WIDTH}`} className="stat-chart-baseline" />
          {series.map(item => (
            <g key={item.source}>
              {cumulative && <path d={`${item.path} V ${STAT_CHART_HEIGHT} H 0 Z`} fill={`url(#${gradientId}-${item.source})`} />}
              <path d={item.path} fill="none" stroke={STAT_FLOW_COLORS[item.source]} strokeWidth={1.8}
                strokeDasharray={item.source === 'evo' ? '4 2' : undefined} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {days.map((day, index) => (
            <g key={day.date.getTime()} onPointerEnter={() => setActive(index)}>
              {active === index && <rect x={index / days.length * STAT_CHART_WIDTH} y={0}
                width={STAT_CHART_WIDTH / days.length} height={STAT_CHART_HEIGHT} fill="currentColor" opacity={0.15} />}
              <rect x={index / days.length * STAT_CHART_WIDTH} y={-2}
                width={STAT_CHART_WIDTH / days.length} height={STAT_CHART_HEIGHT + 4} fill="transparent" />
            </g>
          ))}
        </svg>
        {selected && <div className="stat-chart-tooltip" role="status">
          <span>{chartDate(selected.date)} · {cumulative ? 'cumulative' : 'daily'} · DASH</span>
          {series.map(item => <div key={item.source}>
            <span style={{ color: STAT_FLOW_COLORS[item.source] }}>{STAT_FLOW_LABELS[item.source]}</span>
            <strong>{creditsToDash(item.readings[active!])}</strong>
          </div>)}
        </div>}
      </div>
      <div className="stat-chart-axis" aria-hidden="true">
        <span>{days[0] && chartDate(days[0].date)}</span>
        <span>{days.at(-1) && chartDate(days.at(-1)!.date)}</span>
      </div>
      <div className="stat-chart-totals">
        {series.map(item => <span key={item.source} className={`stat-flow-${item.source}`}
          title={`${STAT_FLOW_LABELS[item.source]} ${direction} in 30 days: ${creditsToDash(item.total)} DASH`}>
          <i aria-hidden="true" />{formatStatCredits(item.total)}
        </span>)}
      </div>
    </div>
  )
}
