import { useId, useState } from 'react'
import { CHART_HEIGHT, CHART_WIDTH } from '@renderer/constants/dashboardAnalytics'
import type { DailyChartProps } from '@renderer/types/DashboardAnalytics'
import { balanceChartScale, balanceLinePath, chartDate, chartRatio } from '@renderer/utils/dashboardAnalytics'
import { davToDash, davToDashCompact } from '@renderer/utils/balance'

export default function DailyChart({ days }: DailyChartProps): React.JSX.Element {
  const [active, setActive] = useState<number | null>(null)
  const hintId = useId()
  const tooltipId = useId()
  const gradientId = useId()
  const scale = balanceChartScale(days)
  const line = balanceLinePath(days, scale)
  const area = `${line} L ${(days.length - 0.5) / days.length * CHART_WIDTH} ${CHART_HEIGHT} L ${0.5 / days.length * CHART_WIDTH} ${CHART_HEIGHT} Z`
  const selectedIndex = active === null ? null : Math.min(active, days.length - 1)
  const selected = selectedIndex === null ? undefined : days[selectedIndex]
  const tickIndexes = [...new Set(Array.from({ length: 3 }, (_, index) => Math.round(index * (days.length - 1) / 2)))]
  const showYear = days[0].date.getFullYear() !== days.at(-1)!.date.getFullYear()

  return (
    <div className="daily-chart">
      <div id={tooltipId} className="chart-toolbar" role="status" aria-live="polite">
        <span>{selected ? chartDate(selected.date, true) : 'DASH'}</span>
        {selected ? <strong><span className="sr-only">{selectedIndex === days.length - 1 ? 'Current balance: ' : 'Closing balance: '}</span>{davToDash(selected.balance)} DASH</strong> : <span>Daily balance</span>}
      </div>
      <div className="chart-coordinate-system">
        <div className="chart-y-axis" aria-hidden="true">
          {scale.ticks.map(tick => <span key={String(tick)}>{davToDashCompact(tick, 8)}</span>)}
        </div>
        <div
          className="chart-plot"
          tabIndex={0}
          role="group"
          aria-label="Daily Core balance in DASH"
          aria-describedby={`${hintId} ${selected ? tooltipId : ''}`}
          onPointerMove={event => {
            const bounds = event.currentTarget.getBoundingClientRect()
            setActive(Math.max(0, Math.min(days.length - 1, Math.floor((event.clientX - bounds.left) / bounds.width * days.length))))
          }}
          onPointerLeave={event => { if (document.activeElement !== event.currentTarget) setActive(null) }}
          onFocus={() => setActive(days.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={event => {
            if (event.key === 'Escape') { setActive(null); return }
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            setActive(index => {
              if (event.key === 'Home') return 0
              if (event.key === 'End') return days.length - 1
              return Math.max(0, Math.min(days.length - 1, (index ?? days.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1)))
            })
          }}
        >
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-core)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--chart-core)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {scale.ticks.map((tick, index) => (
              <line key={String(tick)} x1={0} x2={CHART_WIDTH} y1={index * CHART_HEIGHT / (scale.ticks.length - 1)} y2={index * CHART_HEIGHT / (scale.ticks.length - 1)} className="chart-gridline" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke="var(--chart-core)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="chart-balance-dot" style={{ left: `${(days.length - 0.5) / days.length * 100}%`, top: `${(1 - chartRatio(days.at(-1)!.balance - scale.min, scale.max - scale.min)) * 100}%` }} />
          {selected && selectedIndex !== null && (
            <>
              <div className="chart-crosshair" style={{ left: `${(selectedIndex + 0.5) / days.length * 100}%` }} />
              <span className="chart-balance-dot" style={{ left: `${(selectedIndex + 0.5) / days.length * 100}%`, top: `${(1 - chartRatio(selected.balance - scale.min, scale.max - scale.min)) * 100}%` }} />
            </>
          )}
        </div>
        <div className="chart-x-axis" aria-hidden="true">
          {tickIndexes.map(index => <span key={index} style={{ left: `${(index + 0.5) / days.length * 100}%` }}>{chartDate(days[index].date, showYear)}</span>)}
        </div>
      </div>
      <p id={hintId} className="sr-only">Daily closing balance in local time; today shows the current balance. Linear Y axis from {davToDash(scale.min)} to {davToDash(scale.max)} DASH. Hover or use ← → to explore.</p>
    </div>
  )
}
