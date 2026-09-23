import type { AnalyticsPeriod, ChartSeries } from '../types/DashboardAnalytics'

export const ANALYTICS_PERIODS: AnalyticsPeriod[] = [7, 30, 90, 'all']
export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = 30
export const CHART_WIDTH = 1000
export const CHART_HEIGHT = 200
export const CHART_SERIES: Record<'flow' | 'count', ChartSeries[]> = {
  flow: [
    { key: 'received', label: 'Received', color: 'var(--chart-core)' },
    { key: 'sent', label: 'Sent', color: 'var(--chart-sent)' },
  ],
  count: [
    { key: 'core', label: 'Core', color: 'var(--chart-core)' },
    { key: 'evo', label: 'Evo', color: 'var(--chart-evo)' },
  ],
}
