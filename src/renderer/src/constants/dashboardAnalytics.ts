import type { AnalyticsPeriod } from '../types/DashboardAnalytics'

export const ANALYTICS_PERIODS: AnalyticsPeriod[] = [7, 30, 90, 'all']
export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = 30
export const CHART_WIDTH = 1000
export const CHART_HEIGHT = 200
export const EVO_TYPE_LIMIT = 5
export const BALANCE_SEGMENTS = [
  { label: 'Core', color: 'var(--chart-core)' },
  { label: 'Platform', color: 'var(--chart-evo)' },
  { label: 'Shielded', color: 'var(--chart-shielded)' },
]
