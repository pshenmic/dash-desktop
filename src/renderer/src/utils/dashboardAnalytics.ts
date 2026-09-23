import type { PlatformTransaction } from '../api/types'
import { CHART_HEIGHT, CHART_WIDTH } from '../constants/dashboardAnalytics'
import type { ActivityDay, AnalyticsCoreTransaction, AnalyticsPeriod, ChartScale, DashboardAnalytics, EvoTypeCount } from '../types/DashboardAnalytics'
import { platformTransactionTitle } from './platformTransactions'

export function activityDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function buildDashboardAnalytics(
  core: AnalyticsCoreTransaction[],
  platform: PlatformTransaction[],
  period: AnalyticsPeriod,
  now = new Date(),
): DashboardAnalytics {
  let firstDate = now
  if (period === 'all') {
    for (const transactions of [core, platform]) {
      for (const tx of transactions) {
        if (tx.date.getTime() > 0 && tx.date < firstDate) firstDate = tx.date
      }
    }
  }
  const start = period === 'all'
    ? new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate())
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - period + 1)
  const days: ActivityDay[] = []
  for (const cursor = new Date(start); cursor <= now; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor)
    days.push({ key: activityDayKey(date), date, received: 0n, sent: 0n, core: 0, evo: 0 })
  }
  const buckets = new Map(days.map(day => [day.key, day]))
  const types = new Map<string, EvoTypeCount>()
  const seen = new Set<string>()
  const result: DashboardAnalytics = {
    days, types: [], received: 0n, sent: 0n, coreCount: 0, evoCount: 0, undatedCount: 0,
  }

  function bucketFor(id: string, date: Date): ActivityDay | undefined {
    if (seen.has(id)) return undefined
    seen.add(id)
    if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) {
      result.undatedCount++
      return undefined
    }
    if (date > now) return undefined
    return buckets.get(activityDayKey(date))
  }

  for (const tx of core) {
    const day = bucketFor(`core:${tx.id.toLowerCase()}`, tx.date)
    if (!day) continue
    day.core++
    result.coreCount++
    if (tx.status !== 'success') continue
    const amount = tx.amount < 0n ? -tx.amount : tx.amount
    if (tx.direction === 'in') {
      day.received += amount
      result.received += amount
    } else {
      day.sent += amount
      result.sent += amount
    }
  }
  for (const tx of platform) {
    const day = bucketFor(`evo:${tx.hash.toLowerCase()}`, tx.date)
    if (!day) continue
    day.evo++
    result.evoCount++
    const type = tx.type.trim().toUpperCase() || 'UNKNOWN'
    const entry = types.get(type) ?? { type, label: platformTransactionTitle(type), count: 0 }
    entry.count++
    types.set(type, entry)
  }
  result.types = [...types.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return result
}

export function chartScale(max: bigint): ChartScale {
  const target = max > 0n ? (max + 3n) / 4n : 1n
  const magnitude = 10n ** BigInt(target.toString().length - 1)
  const step = [1n, 2n, 5n, 10n].map(value => value * magnitude).find(value => value >= target)!
  return { max: step * 4n, ticks: [4n, 3n, 2n, 1n, 0n].map(value => value * step) }
}

export function chartRatio(value: bigint, max: bigint): number {
  if (max <= 0n) return 0
  return Number(value * 1_000_000n / max) / 1_000_000
}

export function dailyLinePath(days: ActivityDay[], key: 'received' | 'sent', max: bigint): string {
  if (days.length === 1) {
    const y = (1 - chartRatio(days[0][key], max)) * CHART_HEIGHT
    return `M 0 ${y} L ${CHART_WIDTH} ${y}`
  }
  return days.map((day, index) => {
    const x = (index + 0.5) / days.length * CHART_WIDTH
    const y = (1 - chartRatio(day[key], max)) * CHART_HEIGHT
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
}

export function chartDate(date: Date, full = false): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(full ? { year: 'numeric' } : {}) })
}
