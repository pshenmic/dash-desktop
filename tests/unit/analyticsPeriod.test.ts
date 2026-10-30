import { describe, it, expect } from 'vitest'
import { analyticsPeriodFromKey, analyticsPeriodKey, analyticsPeriodLabel, analyticsPeriodOptions } from '../../src/renderer/src/utils/analyticsPeriod'
import { ANALYTICS_PERIODS } from '../../src/renderer/src/constants/dashboardAnalytics'

describe('analytics period', () => {
  it('labels day ranges and the all-time range', () => {
    expect(analyticsPeriodLabel(7)).toBe('7 days')
    expect(analyticsPeriodLabel(90)).toBe('90 days')
    expect(analyticsPeriodLabel('all')).toBe('All time')
  })

  it('round-trips every period through its key', () => {
    for (const period of ANALYTICS_PERIODS) expect(analyticsPeriodFromKey(analyticsPeriodKey(period))).toBe(period)
    expect(analyticsPeriodKey(30)).toBe('30')
  })

  it('builds one option per period in order', () => {
    expect(analyticsPeriodOptions()).toEqual([
      { value: '7', label: '7 days' },
      { value: '30', label: '30 days' },
      { value: '90', label: '90 days' },
      { value: 'all', label: 'All time' },
    ])
  })
})
