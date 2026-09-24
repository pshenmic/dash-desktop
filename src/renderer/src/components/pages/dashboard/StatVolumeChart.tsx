import React, { useId, useState } from 'react'
import type { StatVolumeChartProps } from '@renderer/types/DashboardStats'
import { STAT_CHART_HEIGHT, STAT_CHART_WIDTH, STAT_FLOW_COLORS, STAT_FLOW_LABELS } from '@renderer/constants/dashboardStats'
import { buildStatChartSeries } from '@renderer/utils/dashboardStatCharts'
import { chartDate } from '@renderer/utils/dashboardAnalytics'
import { creditsToDash } from '@renderer/utils/balance'

export default function StatVolumeChart({ flows, direction, hidden, platformFailed = false }: StatVolumeChartProps): React.JSX.Element {
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId()
  const days = flows[0]?.days ?? []
  const series = buildStatChartSeries(flows, direction)
  const selected = active === null ? undefined : days[active]
  const cumulative = direction === 'received'

  if (hidden) return <div className="grid h-[51px] place-items-center text-[11px] text-(--stat-muted)">Amounts hidden</div>

  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-[3px] text-[10px] text-(--stat-muted)">
        <span>30 days</span>
        {platformFailed && <span className="font-semibold text-(--stat-evo)">Evo partial</span>}
      </div>
      <div className="relative h-8 rounded-[3px] text-(--stat-accent) focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--stat-accent)" tabIndex={0} role="group"
        aria-label={`${cumulative ? 'Cumulative received' : 'Daily sent'} for Core and Evo over the last 30 calendar days, on the same DASH scale. ${series.map(item => `${STAT_FLOW_LABELS[item.source]} total: ${creditsToDash(item.total)} DASH`).join('. ')}. ${platformFailed ? 'Evo history is incomplete. ' : ''}Hover or use left and right arrows to explore amounts.`}
        onPointerLeave={() => setActive(null)} onFocus={() => setActive(days.length - 1)} onBlur={() => setActive(null)}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
          event.preventDefault()
          setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? days.length - 1
            : Math.max(0, Math.min(days.length - 1, (index ?? days.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))))
        }}>
        <svg className="block size-full overflow-visible" viewBox={`0 -2 ${STAT_CHART_WIDTH} ${STAT_CHART_HEIGHT + 4}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            {series.map(item => (
              <linearGradient key={item.source} id={`${gradientId}-${item.source}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STAT_FLOW_COLORS[item.source]} stopOpacity="0.2" />
                <stop offset="100%" stopColor={STAT_FLOW_COLORS[item.source]} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>
          <path d={`M 0 ${STAT_CHART_HEIGHT} H ${STAT_CHART_WIDTH}`} className="stroke-(--stat-track) stroke-1" />
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
        {selected && <div className="pointer-events-none absolute right-0 bottom-[calc(100%+6px)] z-2 min-w-[175px] max-w-60 rounded-[10px] bg-white px-[11px] py-[9px] text-[10px] text-dash-primary-dark-blue shadow-[0_4px_20px_#0003] dark:border dark:border-white/15 dark:bg-[#152d50] dark:text-white" role="status">
          <span className="mb-[5px] block opacity-65">{chartDate(selected.date)} · {cumulative ? 'cumulative' : 'daily'} · DASH</span>
          {series.map(item => <div key={item.source} className="mt-[3px] flex justify-between gap-3">
            <span style={{ color: STAT_FLOW_COLORS[item.source] }}>{STAT_FLOW_LABELS[item.source]}</span>
            <strong className="font-semibold tabular-nums wrap-anywhere">{creditsToDash(item.readings[active!])}</strong>
          </div>)}
          <span className="mt-[9px] mb-[5px] block border-t border-current pt-[7px] opacity-65">30-day totals · {days[0] && chartDate(days[0].date)} – {days.at(-1) && chartDate(days.at(-1)!.date)}</span>
          {series.map(item => <div key={`total-${item.source}`} className="mt-[3px] flex justify-between gap-3">
            <span style={{ color: STAT_FLOW_COLORS[item.source] }}>{STAT_FLOW_LABELS[item.source]}</span>
            <strong className="font-semibold tabular-nums wrap-anywhere">{creditsToDash(item.total)}</strong>
          </div>)}
        </div>}
      </div>
    </div>
  )
}
