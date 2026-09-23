import { useId, useState } from 'react'
import { CHART_HEIGHT, CHART_SERIES, CHART_WIDTH } from '@renderer/constants/dashboardAnalytics'
import { DUFFS_PER_DASH } from '@renderer/constants/balance'
import type { DailyChartProps } from '@renderer/types/DashboardAnalytics'
import { chartDate, chartRatio, chartScale, dailyLinePath } from '@renderer/utils/dashboardAnalytics'
import { davToDash, davToDashCompact } from '@renderer/utils/balance'

export default function DailyChart({ days, mode }: DailyChartProps): React.JSX.Element {
  const [active, setActive] = useState<number | null>(null)
  const hintId = useId()
  const tooltipId = useId()
  const series = CHART_SERIES[mode]
  const maximum = days.reduce((max, day) => {
    const value = mode === 'flow'
      ? (day.received > day.sent ? day.received : day.sent)
      : BigInt(day.core + day.evo)
    return value > max ? value : max
  }, 0n)
  const scale = chartScale(maximum === 0n && mode === 'flow' ? DUFFS_PER_DASH : maximum)
  const selectedIndex = active === null ? null : Math.min(active, days.length - 1)
  const selected = selectedIndex === null ? undefined : days[selectedIndex]
  const tickIndexes = [...new Set(Array.from({ length: 3 }, (_, index) => Math.round(index * (days.length - 1) / 2)))]
  const showYear = days[0].date.getFullYear() !== days.at(-1)!.date.getFullYear()

  return (
    <div className="daily-chart">
      <div className="chart-toolbar">
        <span className="chart-axis-caption">{mode === 'flow' ? 'DASH' : 'Transactions'}</span>
        <div className="chart-legend">
          {series.map(item => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}
        </div>
      </div>
      <div className="chart-coordinate-system">
        <div className="chart-y-axis" aria-hidden="true">
          {scale.ticks.map(tick => <span key={String(tick)}>{mode === 'flow' ? davToDashCompact(tick, 8) : String(tick)}</span>)}
        </div>
        <div
          className="chart-plot"
          tabIndex={0}
          role="group"
          aria-label={mode === 'flow' ? 'Daily Core received and sent amounts' : 'Daily Core and Evo transaction counts'}
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
            {scale.ticks.map((tick, index) => (
              <line key={String(tick)} x1={0} x2={CHART_WIDTH} y1={index * CHART_HEIGHT / 4} y2={index * CHART_HEIGHT / 4} className="chart-gridline" vectorEffect="non-scaling-stroke" />
            ))}
            {mode === 'flow' ? (
              <>
                <path d={dailyLinePath(days, 'received', scale.max)} fill="none" stroke={series[0].color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                <path d={dailyLinePath(days, 'sent', scale.max)} fill="none" stroke={series[1].color} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              </>
            ) : days.map((day, index) => {
              const coreHeight = chartRatio(BigInt(day.core), scale.max) * CHART_HEIGHT
              const evoHeight = chartRatio(BigInt(day.evo), scale.max) * CHART_HEIGHT
              const width = CHART_WIDTH / days.length
              return (
                <g key={day.key}>
                  <rect x={(index + 0.18) * width} width={width * 0.64} y={CHART_HEIGHT - coreHeight} height={coreHeight} fill={series[0].color} rx={1.5} />
                  <rect x={(index + 0.18) * width} width={width * 0.64} y={CHART_HEIGHT - coreHeight - evoHeight} height={evoHeight} fill={series[1].color} rx={1.5} />
                </g>
              )
            })}
          </svg>
          {maximum === 0n && active === null && <div className="chart-zero-label">{mode === 'flow' ? 'No successful Core transfers in this period' : 'No transactions in this period'}</div>}
          {selected && selectedIndex !== null && (
            <>
              <div className="chart-crosshair" style={{ left: `${(selectedIndex + 0.5) / days.length * 100}%` }} />
              {mode === 'flow' && series.map(item => (
                <span key={item.key} className="chart-active-dot" aria-hidden="true" style={{
                  left: `${(selectedIndex + 0.5) / days.length * 100}%`,
                  top: `${(1 - chartRatio(BigInt(selected[item.key]), scale.max)) * 100}%`,
                  background: item.color,
                }} />
              ))}
              <div id={tooltipId} className={`chart-tooltip ${selectedIndex > days.length / 2 ? 'chart-tooltip-left' : ''}`} role="status" aria-live="polite">
                <strong>{chartDate(selected.date, true)}</strong>
                {series.map(item => (
                  <div key={item.key}>
                    <span><i style={{ background: item.color }} />{item.label}</span>
                    <b>{mode === 'flow' ? `${davToDash(BigInt(selected[item.key]))} DASH` : selected[item.key].toLocaleString('en-US')}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="chart-x-axis" aria-hidden="true">
          {tickIndexes.map(index => <span key={index} style={{ left: `${(index + 0.5) / days.length * 100}%` }}>{chartDate(days[index].date, showYear)}</span>)}
        </div>
      </div>
      <p id={hintId} className="sr-only">Daily totals · Hover or use ← → to explore</p>
    </div>
  )
}
