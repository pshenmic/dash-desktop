import { useId, useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import { DASH_UNIT } from '@renderer/constants/balance'
import { ANALYTICS_CROSSHAIR, ANALYTICS_DOT, ANALYTICS_FOCUS, ANALYTICS_GRID_STROKE, ANALYTICS_PLOT_HEIGHT, ANALYTICS_SERIES, CHART_HEIGHT, CHART_WIDTH } from '@renderer/constants/dashboardAnalytics'
import { dashboardPage } from '@renderer/constants/dashboardPage'
import type { DailyChartProps } from '@renderer/types/DashboardAnalytics'
import { balanceChartScale, balanceLinePath, chartDate, chartRatio } from '@renderer/utils/dashboardAnalytics'
import { davToDash, davToDashCompact } from '@renderer/utils/balance'

export default function DailyChart({ days }: DailyChartProps): React.JSX.Element {
  const [active, setActive] = useState<number | null>(null)
  const hintId = useId()
  const tooltipId = useId()
  const scale = balanceChartScale(days)
  const line = balanceLinePath(days, scale)
  const area = `${line} L ${(days.length - 0.5) / days.length * CHART_WIDTH} ${CHART_HEIGHT} L ${0.5 / days.length * CHART_WIDTH} ${CHART_HEIGHT} Z`
  const selectedIndex = active === null ? null : Math.min(active, days.length - 1)
  const selected = selectedIndex === null ? undefined : days[selectedIndex]
  const readoutIndex = selectedIndex ?? days.length - 1
  const readout = days[readoutIndex]
  const tickIndexes = [...new Set(Array.from({ length: 3 }, (_, index) => Math.round(index * (days.length - 1) / 2)))]
  const showYear = days[0].date.getFullYear() !== days.at(-1)!.date.getFullYear()
  const labels = dashboardPage.analytics.coreBalance

  return (
    <div className="flex flex-col gap-3">
      <div id={tooltipId} className="flex items-baseline justify-between gap-2" role="status" aria-live="polite">
        <Text size={20} weight="extrabold" color="brand" className="leading-[140%] tabular-nums">
          <span className="sr-only">{readoutIndex === days.length - 1 ? labels.current : labels.closing}</span>
          <DashBigNumber>{davToDash(readout.balance)}</DashBigNumber>
          <span className="font-medium"> {DASH_UNIT}</span>
        </Text>
        <Text size={12} weight="medium" color="brand" opacity={50} className="leading-[120%]">{chartDate(readout.date, true)}</Text>
      </div>
      <div className="grid grid-cols-[max-content_minmax(0,1fr)] pr-4">
        <span className="mb-2.5 pr-2.5 text-right" aria-hidden="true">
          <Text size={10} weight="medium" color="brand" opacity={50}>{DASH_UNIT}</Text>
        </span>
        <div className={`col-start-1 flex ${ANALYTICS_PLOT_HEIGHT} min-w-8 flex-col items-end justify-between pr-2.5`} aria-hidden="true">
          {scale.ticks.map(tick => <Text key={String(tick)} size={10} weight="medium" color="brand" opacity={50} className="leading-0 tabular-nums">{davToDashCompact(tick, 8)}</Text>)}
        </div>
        <div
          className={`relative ${ANALYTICS_PLOT_HEIGHT} rounded-lg ${ANALYTICS_FOCUS}`}
          tabIndex={0}
          role="group"
          aria-label={`Daily Core balance in ${DASH_UNIT}`}
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
          <svg className="block size-full overflow-visible" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            {scale.ticks.map((tick, index) => (
              <line key={String(tick)} x1={0} x2={CHART_WIDTH} y1={index * CHART_HEIGHT / (scale.ticks.length - 1)} y2={index * CHART_HEIGHT / (scale.ticks.length - 1)} className={ANALYTICS_GRID_STROKE} vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} className={ANALYTICS_SERIES.core.area} />
            <path d={line} fill="none" className={ANALYTICS_SERIES.core.stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${ANALYTICS_DOT} ${ANALYTICS_SERIES.core.fill}`} style={{ left: `${(days.length - 0.5) / days.length * 100}%`, top: `${(1 - chartRatio(days.at(-1)!.balance - scale.min, scale.max - scale.min)) * 100}%` }} />
          {selected && selectedIndex !== null && (
            <>
              <div className={`pointer-events-none absolute inset-y-0 ${ANALYTICS_CROSSHAIR}`} style={{ left: `${(selectedIndex + 0.5) / days.length * 100}%` }} />
              <span className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${ANALYTICS_DOT} ${ANALYTICS_SERIES.core.fill}`} style={{ left: `${(selectedIndex + 0.5) / days.length * 100}%`, top: `${(1 - chartRatio(selected.balance - scale.min, scale.max - scale.min)) * 100}%` }} />
            </>
          )}
        </div>
        <div className="relative col-start-2 mt-2.5 h-3.5" aria-hidden="true">
          {tickIndexes.map(index => (
            <span key={index} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(index + 0.5) / days.length * 100}%` }}>
              <Text reset size={10} weight="medium" color="brand" opacity={50}>{chartDate(days[index].date, showYear)}</Text>
            </span>
          ))}
        </div>
      </div>
      <p id={hintId} className="sr-only">Daily closing balance in local time; today shows the current balance. Linear Y axis from {davToDash(scale.min)} to {davToDash(scale.max)} {DASH_UNIT}. Hover or use ← → to explore.</p>
    </div>
  )
}
