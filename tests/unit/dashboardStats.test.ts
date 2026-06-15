import { describe, it, expect } from 'vitest'
import { computeWalletStats, formatWalletAge, StatsTx } from '../../src/renderer/src/utils/dashboardStats'

const NOW = new Date('2026-06-10T12:00:00Z')
const DASH = 100_000_000n

function tx(overrides: Partial<StatsTx>): StatsTx {
  return {
    amount: DASH,
    direction: 'in',
    status: 'success',
    date: new Date('2026-06-01T10:00:00Z'),
    ...overrides
  }
}

describe('computeWalletStats', () => {
  it('returns zeroed stats for an empty wallet', () => {
    const stats = computeWalletStats([], NOW)
    expect(stats.txCount).toBe(0)
    expect(stats.totalReceived).toBe(0n)
    expect(stats.totalSent).toBe(0n)
    expect(stats.firstTxDate).toBeNull()
    expect(stats.lastTxDate).toBeNull()
    expect(stats.walletAgeDays).toBe(0)
    expect(stats.netFlow30d).toBe(0n)
    expect(stats.monthlyActivity).toHaveLength(6)
    expect(stats.monthlyActivity.every((m) => m.count === 0)).toBe(true)
  })

  it('splits totals and counts by direction', () => {
    const stats = computeWalletStats([
      tx({ direction: 'in', amount: 3n * DASH }),
      tx({ direction: 'in', amount: 1n * DASH }),
      tx({ direction: 'out', amount: 2n * DASH })
    ], NOW)
    expect(stats.txCount).toBe(3)
    expect(stats.receivedCount).toBe(2)
    expect(stats.sentCount).toBe(1)
    expect(stats.totalReceived).toBe(4n * DASH)
    expect(stats.totalSent).toBe(2n * DASH)
    expect(stats.largestReceived).toBe(3n * DASH)
    expect(stats.largestSent).toBe(2n * DASH)
  })

  it('excludes failed transactions from sums but keeps them in txCount', () => {
    const stats = computeWalletStats([
      tx({ status: 'failed', amount: 5n * DASH }),
      tx({ amount: DASH })
    ], NOW)
    expect(stats.txCount).toBe(2)
    expect(stats.totalReceived).toBe(DASH)
    expect(stats.largestReceived).toBe(DASH)
  })

  it('counts pending transactions', () => {
    const stats = computeWalletStats([
      tx({ status: 'pending' }),
      tx({ status: 'success' })
    ], NOW)
    expect(stats.pendingCount).toBe(1)
  })

  it('tracks first/last activity and wallet age in days', () => {
    const first = new Date('2026-01-10T00:00:00Z')
    const last = new Date('2026-06-09T00:00:00Z')
    const stats = computeWalletStats([
      tx({ date: last }),
      tx({ date: first }),
      tx({ date: new Date('2026-03-01T00:00:00Z') })
    ], NOW)
    expect(stats.firstTxDate).toEqual(first)
    expect(stats.lastTxDate).toEqual(last)
    expect(stats.walletAgeDays).toBe(151)
  })

  it('computes 30-day flows and net flow', () => {
    const stats = computeWalletStats([
      tx({ direction: 'in', amount: 5n * DASH, date: new Date('2026-06-01T00:00:00Z') }),
      tx({ direction: 'out', amount: 2n * DASH, date: new Date('2026-05-20T00:00:00Z') }),
      tx({ direction: 'in', amount: 100n * DASH, date: new Date('2026-01-01T00:00:00Z') })
    ], NOW)
    expect(stats.received30d).toBe(5n * DASH)
    expect(stats.sent30d).toBe(2n * DASH)
    expect(stats.netFlow30d).toBe(3n * DASH)
  })

  it('buckets activity into the last N calendar months, oldest first', () => {
    const stats = computeWalletStats([
      tx({ direction: 'in', amount: DASH, date: new Date('2026-06-05T00:00:00Z') }),
      tx({ direction: 'out', amount: 2n * DASH, date: new Date('2026-04-15T00:00:00Z') }),
      tx({ direction: 'in', amount: DASH, date: new Date('2025-12-31T00:00:00Z') })
    ], NOW, 6)
    expect(stats.monthlyActivity.map((m) => m.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'])
    expect(stats.monthlyActivity[5].received).toBe(DASH)
    expect(stats.monthlyActivity[5].count).toBe(1)
    expect(stats.monthlyActivity[3].sent).toBe(2n * DASH)
    expect(stats.monthlyActivity[0].count).toBe(0)
  })

  it('spans a year boundary in month buckets', () => {
    const stats = computeWalletStats([], new Date('2026-02-15T00:00:00Z'), 6)
    expect(stats.monthlyActivity.map((m) => `${m.label} ${m.year}`)).toEqual([
      'Sept 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026'
    ])
  })
})

describe('formatWalletAge', () => {
  it('formats day, month and year ranges', () => {
    expect(formatWalletAge(0)).toBe('New')
    expect(formatWalletAge(1)).toBe('1 day')
    expect(formatWalletAge(45)).toBe('45 days')
    expect(formatWalletAge(61)).toBe('2 months')
    expect(formatWalletAge(364)).toBe('12 months')
    expect(formatWalletAge(800)).toBe('2 years')
    expect(formatWalletAge(400)).toBe('13 months')
    expect(formatWalletAge(730)).toBe('2 years')
  })
})
