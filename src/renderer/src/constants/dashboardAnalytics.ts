import type { AnalyticsPeriod, BalanceSegment } from '../types/DashboardAnalytics'
import { PROGRESS_FILL, PROGRESS_TRACK } from './progressBar'

export const ANALYTICS_PERIODS: AnalyticsPeriod[] = [7, 30, 90, 'all']
export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = 30
export const CHART_WIDTH = 1000
export const CHART_HEIGHT = 200
export const EVO_TYPE_LIMIT = 5
export const SHIELDED_SEGMENT_LABEL = 'Shielded'
export const ALLOCATION_AMOUNT_FLOOR = '<0.001'
export const BALANCE_SEGMENTS: Pick<BalanceSegment, 'label' | 'series'>[] = [
  { label: 'Core', series: 'core' },
  { label: 'Platform', series: 'evo' },
  { label: SHIELDED_SEGMENT_LABEL, series: 'shielded' },
]

export const ANALYTICS_GRID = 'grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3'
export const ANALYTICS_PLOT_HEIGHT = 'h-40'

export const ANALYTICS_SERIES = {
  core: { fill: 'bg-dash-brand dark:bg-dash-mint', stroke: 'stroke-dash-brand dark:stroke-dash-mint', area: 'fill-dash-brand/10 dark:fill-dash-mint/10' },
  evo: { fill: 'bg-violet-700 dark:bg-violet-300', stroke: 'stroke-violet-700 dark:stroke-violet-300' },
  shielded: { fill: 'bg-violet-400 dark:bg-violet-500' },
}

export const ANALYTICS_METER = {
  core: { track: PROGRESS_TRACK, fill: PROGRESS_FILL },
  evo: { track: 'h-1 w-full overflow-hidden rounded-full bg-violet-500/15 dark:bg-violet-400/20', fill: 'h-full rounded-full bg-violet-700 dark:bg-violet-300' },
}

export const ANALYTICS_GRID_STROKE = 'stroke-dash-primary-dark-blue/8 dark:stroke-white/10'
export const ANALYTICS_BASELINE_STROKE = 'stroke-dash-primary-dark-blue/10 dark:stroke-white/15'
export const ANALYTICS_CROSSHAIR = 'w-px bg-dash-primary-dark-blue/20 dark:bg-white/25'
export const ANALYTICS_DOT = 'size-2 rounded-full ring-2 ring-white dark:ring-dash-light-gray'
export const ANALYTICS_FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint'
export const ANALYTICS_PLACEHOLDER = 'grid place-items-center gap-2 rounded-[.9375rem] dash-block-3 p-4 text-center'
export const ANALYTICS_PULSE = 'animate-pulse rounded-[.9375rem] bg-dash-primary-dark-blue/8 dark:bg-white/8'
