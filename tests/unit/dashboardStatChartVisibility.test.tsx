import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StatVolumeChart from '@renderer/components/pages/dashboard/StatVolumeChart'
import Statistics from '@renderer/components/pages/dashboard/Statistics'
import { buildStatFlows } from '@renderer/utils/dashboardStatCharts'
import { buildDashboardAnalytics } from '@renderer/utils/dashboardAnalytics'
import type { PlatformTransaction } from '@renderer/api/types'

vi.mock('@renderer/hooks/useBalanceVisibility', () => ({ useBalanceVisibility: () => ({ isBalanceVisible: true }) }))
vi.mock('@renderer/hooks/useFiat', () => ({ useFiat: () => ({ rateReady: false, format: () => '' }) }))
vi.mock('@renderer/components/pages/dashboard/StatAddressUsage', () => ({ default: () => null }))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('statistics chart visibility', () => {
  it.each(['received', 'sent'] as const)('omits amounts and data-derived geometry from a hidden %s chart', direction => {
    const now = new Date()
    const days = buildDashboardAnalytics([], [], 30, now).days
    const flows = buildStatFlows([{ amount: 123_456_789n, direction: 'in', status: 'success', date: now }], [], days, now)
    const markup = renderToStaticMarkup(<StatVolumeChart flows={flows} direction={direction} period={30} hidden />)
    const empty = renderToStaticMarkup(<StatVolumeChart flows={buildStatFlows([], [], days, now)} direction={direction} period={30} hidden />)
    expect(markup).toBe(empty)
    expect(markup).toContain('Amounts hidden')
    expect(markup).not.toContain('<svg')
  })

  it.each([7, 30, 90, 'all'] as const)('renders the selected %s period with accurate labels and valid empty chart geometry', period => {
    const now = new Date()
    const days = buildDashboardAnalytics([], [], period, now).days
    const markup = renderToStaticMarkup(<StatVolumeChart flows={buildStatFlows([], [], days, now)} direction="received" period={period} hidden={false} />)
    expect(markup).toContain(period === 'all' ? 'All time' : `${period} days`)
    const ariaLabel = markup.match(/aria-label="([^"]+)"/)?.[1].toLowerCase()
    expect(ariaLabel).toContain(period === 'all' ? 'all time' : `${period} calendar days`)
    if (period !== 30) expect(markup).not.toContain('30 days')
    expect(markup).toContain('Core total: 0 DASH')
    expect(markup).toContain('Evo total: 0 DASH')
    expect(markup).toContain('stroke="var(--stat-brand)"')
    expect(markup).toContain('stroke="var(--stat-evo)"')
    expect(markup).not.toMatch(/NaN|Infinity/)
  })

  it('labels incomplete Evo history instead of presenting it as a complete zero', () => {
    const now = new Date()
    const days = buildDashboardAnalytics([], [], 7, now).days
    const markup = renderToStaticMarkup(<StatVolumeChart flows={buildStatFlows([], [], days, now)} direction="sent" period={7} hidden={false} platformFailed />)
    expect(markup).toContain('Evo partial')
    expect(markup).toContain('Evo history is incomplete')
  })
})

describe('statistics selected period', () => {
  it.each([7, 30, 'all'] as const)('renders counts and amounts for %s while preserving lifetime wallet age', period => {
    const now = new Date(2026, 8, 24, 12)
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.stubGlobal('React', React)
    const transactions = [
      { id: 'old', amount: 300_000_000n, direction: 'in' as const, status: 'success' as const, date: new Date(2026, 8, 1) },
      { id: 'recent', amount: 100_000_000n, direction: 'in' as const, status: 'success' as const, date: new Date(2026, 8, 23) },
    ]
    const platform: PlatformTransaction[] = [{
      walletId: 'wallet', hash: 'evo', type: 'ADDRESS_FUNDS_TRANSFER', date: new Date(2026, 8, 10),
      blockHeight: 100, status: 'SUCCESS', error: null, gasCredits: 0n,
      netCredits: 200_000_000_000n, amountCredits: 200_000_000_000n, sender: [], recipient: [],
    }]
    const days = buildDashboardAnalytics(transactions, platform, period, now).days
    const markup = renderToStaticMarkup(<Statistics transactions={transactions} platform={platform} platformFailed={false} period={period} days={days} />)
    expect(markup).toContain(period === 7 ? '7 days: 1 Core and 0 Evo transactions' : `${period === 'all' ? 'All time' : '30 days'}: 2 Core and 1 Evo transactions`)
    expect(markup).toContain(`Core total: ${period === 7 ? 1 : 4} DASH`)
    expect(markup).toContain(`Evo total: ${period === 7 ? 0 : 2} DASH`)
    expect(markup).toContain('since 1 Sept 2026')
    expect(markup).toContain('>23 days</div>')
  })
})
