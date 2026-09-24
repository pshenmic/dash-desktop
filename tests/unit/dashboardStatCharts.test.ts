import { describe, expect, it } from 'vitest'
import { buildStatActivity, buildStatChartSeries, buildStatFlows, formatStatCredits, statCumulativeAmounts, statCumulativePath, statDailyPath, statShare, summarizeStatActivity, summarizeStatAddresses } from '../../src/renderer/src/utils/dashboardStatCharts'
import type { StatsTx } from '../../src/renderer/src/utils/dashboardStats'
import type { PlatformTransaction } from '../../src/renderer/src/api/types'

describe('statistics activity', () => {
  it('uses 30 local calendar days and excludes failed, undated, future and older transfers', () => {
    const now = new Date(2026, 0, 10, 12)
    const transaction: StatsTx = { amount: 100n, direction: 'in', status: 'success', date: new Date(2025, 11, 12) }
    const days = buildStatActivity([
      transaction,
      { ...transaction, date: new Date(2025, 11, 11, 23, 59) },
      { ...transaction, date: now, direction: 'out', amount: 25n },
      { ...transaction, date: now, status: 'pending', amount: 5n },
      { ...transaction, date: now, status: 'failed' },
      { ...transaction, date: new Date(2026, 0, 10, 13) },
      { ...transaction, date: new Date(NaN) },
      { ...transaction, date: new Date(0) },
    ], now)
    expect(days).toHaveLength(30)
    expect(days[0]).toEqual({ date: new Date(2025, 11, 12), received: 100n, sent: 0n })
    expect(days[29]).toEqual({ date: new Date(2026, 0, 10), received: 5n, sent: 25n })
    expect(days.slice(1, 29).every(day => day.received === 0n && day.sent === 0n)).toBe(true)
  })

  it('zero-fills a wallet with no activity', () => {
    expect(buildStatActivity([]).every(day => day.received === 0n && day.sent === 0n)).toBe(true)
  })
})

describe('statistics chart geometry', () => {
  it('keeps empty daily lines valid and zero-volume periods flat', () => {
    expect(statDailyPath([], 0n)).toBe('')
    expect(statDailyPath([0n, 0n], 0n)).toBe('M 60 40 L 180 40')
  })

  it('accumulates incoming amounts as steps and keeps zero periods flat', () => {
    expect(statCumulativeAmounts([0n, 100n, 0n, 100n])).toEqual([0n, 100n, 100n, 200n])
    expect(statCumulativePath([0n, 100n, 0n, 100n])).toBe('M 0 40 H 60 V 40 H 120 V 20 H 180 V 20 H 240 V 0')
    expect(statCumulativePath([0n, 0n])).toBe('M 0 40 H 120 V 40 H 240 V 40')
    expect(statCumulativePath([])).toBe('M 0 40')
  })

  it('bounds progress shares and handles an empty denominator', () => {
    expect(statShare(57, 190)).toBe(30)
    expect(statShare(0, 0)).toBe(0)
    expect(statShare(3, 2)).toBe(100)
    expect(statShare(-1, 2)).toBe(0)
  })
})

describe('Core and Evo monetary flows', () => {
  const now = new Date(2026, 8, 24, 12)
  const core: StatsTx = { amount: 10n, direction: 'in', status: 'success', date: now }
  const evo: PlatformTransaction = {
    walletId: 'wallet', hash: 'incoming', type: 'ADDRESS_FUNDS_TRANSFER', date: now,
    blockHeight: 100, status: 'SUCCESS', error: null, gasCredits: 500n,
    netCredits: 1n, amountCredits: 1n, sender: [], recipient: [],
  }

  it('keeps source totals separate with credit precision and the same direction semantics as Transactions', () => {
    const flows = buildStatFlows([
      core, { ...core, direction: 'out', status: 'pending', amount: 2n },
      { ...core, status: 'failed', amount: 999n },
    ], [
      evo,
      { ...evo, hash: 'INCOMING' },
      { ...evo, hash: 'outgoing', netCredits: -5n, amountCredits: 7n },
      { ...evo, hash: 'fee', status: 'FAIL', netCredits: -3n, amountCredits: 3n, gasCredits: 3n },
      { ...evo, hash: 'internal', netCredits: 0n, amountCredits: 1_000n },
      { ...evo, hash: 'unknown-status', status: null, netCredits: 2n, amountCredits: 2n },
    ], now)
    expect(flows[0]).toMatchObject({ source: 'core', received: 10_000n, sent: 2_000n })
    expect(flows[1]).toMatchObject({ source: 'evo', received: 3n, sent: 10n })
    expect(flows[1].days[29]).toEqual({ date: new Date(2026, 8, 24), received: 3n, sent: 10n })
  })

  it('keeps old and undated Evo amounts in all-time totals, outside the 30-day chart', () => {
    const flows = buildStatFlows([], [
      { ...evo, hash: 'old', date: new Date(2024, 1, 1), amountCredits: 100n },
      { ...evo, hash: 'undated', date: new Date(0), amountCredits: 200n },
      evo,
    ], now)
    expect(flows[1].received).toBe(301n)
    expect(buildStatChartSeries(flows, 'received')[1].total).toBe(1n)
  })

  it.each(['received', 'sent'] as const)('compares %s series on one credit scale, even above safe integer precision', direction => {
    const max = 2n * 10n ** 30n
    const flows = buildStatFlows([], [], now)
    flows[0].days[29][direction] = max / 2n
    flows[1].days[29][direction] = max
    const series = buildStatChartSeries(flows, direction)
    expect(series[0].path).toMatch(direction === 'received' ? /V 20$/ : / 20$/)
    expect(series[1].path).toMatch(direction === 'received' ? /V 0$/ : / 0$/)
    expect(series[0].total).toBe(max / 2n)
    expect(series[1].total).toBe(max)
  })

  it('does not round a nonzero sub-duff amount to zero', () => {
    expect(formatStatCredits(1n)).toBe('0.00000000001')
    expect(formatStatCredits(999n)).toBe('0.00000000999')
    expect(formatStatCredits(0n)).toBe('0')
    expect(formatStatCredits(123_456_789_000n)).toBe('1.234')
  })
})

describe('Core and Evo address usage', () => {
  it('counts unique Core receiving/change addresses and Evo usage after an address is emptied', () => {
    expect(summarizeStatAddresses([
      { address: 'receiving', isUsed: true },
      { address: 'change', isUsed: true },
      { address: 'unused-core', isUsed: false },
      { address: 'receiving', isUsed: true },
    ], [
      { platformAddress: 'funded', balanceCredits: 1n, nonce: 0 },
      { platformAddress: 'emptied', balanceCredits: 0n, nonce: 2 },
      { platformAddress: 'unused-evo', balanceCredits: 0n, nonce: 0 },
      { platformAddress: 'funded', balanceCredits: 1n, nonce: 0 },
    ])).toEqual([
      { source: 'core', used: 2, total: 3 },
      { source: 'evo', used: 2, total: 3 },
    ])
  })

  it('keeps empty sources separate and never treats missing data as used', () => {
    expect(summarizeStatAddresses([], [])).toEqual([
      { source: 'core', used: 0, total: 0 },
      { source: 'evo', used: 0, total: 0 },
    ])
  })
})

describe('Core and Evo activity summary', () => {
  it('includes Evo in total counts, first activity and latest activity without adding monetary flows', () => {
    const now = new Date(2026, 8, 24, 12)
    const first = new Date(2024, 8, 24, 12)
    const latest = new Date(2026, 8, 24, 11)
    const summary = summarizeStatActivity(
      [{ date: new Date(2026, 8, 1) }],
      [{ hash: 'old', date: first }, { hash: 'latest', date: latest }],
      now,
    )
    expect(summary).toEqual({
      coreCount: 1, evoCount: 2, core30d: 1, evo30d: 1,
      firstDate: first, lastDate: latest, lastSource: 'Evo', ageDays: 730,
    })
  })

  it('supports an Evo-only wallet and deduplicates transition hashes case-insensitively', () => {
    const now = new Date(2026, 8, 24, 12)
    const date = new Date(2026, 8, 24, 11)
    const summary = summarizeStatActivity([], [{ hash: 'ABC', date }, { hash: 'abc', date }], now)
    expect(summary).toMatchObject({ coreCount: 0, evoCount: 1, core30d: 0, evo30d: 1, lastSource: 'Evo', ageDays: 0 })
  })

  it('keeps undated transitions in all-time counts without inventing activity dates', () => {
    const now = new Date(2026, 8, 24, 12)
    const summary = summarizeStatActivity([], [
      { hash: 'undated', date: new Date(0) },
      { hash: 'invalid', date: new Date(NaN) },
      { hash: 'future', date: new Date(2026, 8, 24, 13) },
    ], now)
    expect(summary).toMatchObject({ evoCount: 3, evo30d: 0, firstDate: null, lastDate: null, lastSource: null })
  })

  it('uses the same 30 calendar-day boundary for both networks', () => {
    const now = new Date(2026, 0, 10, 12)
    const dates = [new Date(2025, 11, 11, 23, 59), new Date(2025, 11, 12), now]
    const summary = summarizeStatActivity(dates.map(date => ({ date })), dates.map((date, index) => ({ date, hash: String(index) })), now)
    expect(summary).toMatchObject({ coreCount: 3, evoCount: 3, core30d: 2, evo30d: 2 })
    expect(summarizeStatActivity([], [], now)).toMatchObject({ coreCount: 0, evoCount: 0, firstDate: null, lastDate: null })
  })
})
