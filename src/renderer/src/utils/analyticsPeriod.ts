import { ANALYTICS_ALL_TIME_LABEL, ANALYTICS_DAYS_LABEL } from '../constants/analyticsPeriod'
import { ANALYTICS_PERIODS, DEFAULT_ANALYTICS_PERIOD } from '../constants/dashboardAnalytics'
import type { AnalyticsPeriodKey } from '../types/AnalyticsPeriod'
import type { AnalyticsPeriod } from '../types/DashboardAnalytics'
import type { SegmentOption } from '../types/SegmentedControl'

export function analyticsPeriodLabel(period: AnalyticsPeriod): string {
  return period === 'all' ? ANALYTICS_ALL_TIME_LABEL : `${period} ${ANALYTICS_DAYS_LABEL}`
}

export function analyticsPeriodKey(period: AnalyticsPeriod): AnalyticsPeriodKey {
  return `${period}`
}

export function analyticsPeriodFromKey(key: AnalyticsPeriodKey): AnalyticsPeriod {
  return ANALYTICS_PERIODS.find(period => analyticsPeriodKey(period) === key) ?? DEFAULT_ANALYTICS_PERIOD
}

export function analyticsPeriodOptions(): SegmentOption<AnalyticsPeriodKey>[] {
  return ANALYTICS_PERIODS.map(period => ({ value: analyticsPeriodKey(period), label: analyticsPeriodLabel(period) }))
}
