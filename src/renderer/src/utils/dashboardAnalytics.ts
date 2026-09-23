import type { PlatformTransaction } from '../api/types'
import { BALANCE_SEGMENTS, CHART_HEIGHT, CHART_WIDTH, EVO_TYPE_LIMIT } from '../constants/dashboardAnalytics'
import { DUFFS_PER_DASH } from '../constants/balance'
import type { ActivityDay, AnalyticsCoreTransaction, AnalyticsPeriod, BalanceAllocation, ChartScale, CoreBalanceDay, DashboardAnalytics, EvoTypeCount } from '../types/DashboardAnalytics'
import { creditsToDuffs, davToDashCompact, duffsToCredits } from './balance'
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

export function buildCoreBalanceHistory(core: AnalyticsCoreTransaction[], days: ActivityDay[], currentBalance: bigint): CoreBalanceDay[] | null {
  const changes = new Map<string, bigint>()
  const seen = new Set<string>()
  for (const tx of core) {
    const id = tx.id.toLowerCase()
    if (seen.has(id) || tx.status === 'failed') continue
    seen.add(id)
    if (!Number.isFinite(tx.date.getTime()) || tx.date.getTime() <= 0) return null
    const key = activityDayKey(tx.date)
    const amount = tx.amount < 0n ? -tx.amount : tx.amount
    changes.set(key, (changes.get(key) ?? 0n) + (tx.direction === 'in' ? amount : -amount))
  }
  let balance = currentBalance
  const history: CoreBalanceDay[] = []
  for (let index = days.length - 1; index >= 0; index--) {
    const { key, date } = days[index]
    if (balance < 0n) return null
    history.push({ key, date, balance })
    balance -= changes.get(key) ?? 0n
  }
  return history.reverse()
}

export function balanceChartScale(days: CoreBalanceDay[]): ChartScale {
  let min = days[0].balance
  let max = min
  for (const day of days) {
    if (day.balance < min) min = day.balance
    if (day.balance > max) max = day.balance
  }
  const padding = max > min ? (max - min) / 10n : max > 0n ? max / 100n : DUFFS_PER_DASH
  const margin = padding > 0n ? padding : 1n
  min = min > margin ? min - margin : 0n
  max += margin
  const target = (max - min + 3n) / 4n
  const magnitude = 10n ** BigInt(target.toString().length - 1)
  const step = [1n, 2n, 5n, 10n].map(value => value * magnitude).find(value => value >= target)!
  min = min / step * step
  max = (max + step - 1n) / step * step
  const ticks: bigint[] = []
  for (let tick = max; tick >= min; tick -= step) ticks.push(tick)
  return { min, max, ticks }
}

export function balanceLinePath(days: CoreBalanceDay[], scale: ChartScale): string {
  return days.map((day, index) => {
    const x = (index + 0.5) / days.length * CHART_WIDTH
    const y = (1 - chartRatio(day.balance - scale.min, scale.max - scale.min)) * CHART_HEIGHT
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
}

export function chartRatio(value: bigint, max: bigint): number {
  if (max <= 0n) return 0
  return Number(value * 1_000_000n / max) / 1_000_000
}

export function summarizeEvoTypes(types: EvoTypeCount[]): EvoTypeCount[] {
  const sorted = [...types].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  const top = sorted.slice(0, EVO_TYPE_LIMIT)
  const otherCount = sorted.slice(EVO_TYPE_LIMIT).reduce((sum, item) => sum + item.count, 0)
  if (otherCount > 0) top.push({ type: '__other__', label: 'Other', count: otherCount })
  return top
}

export function buildBalanceAllocation(coreDuffs: bigint, platformCredits: bigint, shieldedCredits: bigint): BalanceAllocation {
  const amounts = [duffsToCredits(coreDuffs), platformCredits, shieldedCredits]
  const total = amounts.reduce((sum, value) => sum + value, 0n)
  let accumulated = 0n
  const segments = BALANCE_SEGMENTS.map((segment, index) => {
    const credits = amounts[index]
    const offset = chartRatio(accumulated, total) * 100
    accumulated += credits
    return { ...segment, credits, offset, share: chartRatio(accumulated, total) * 100 - offset }
  })
  return { total, segments }
}

export function formatAllocationAmount(credits: bigint): string {
  const duffs = creditsToDuffs(credits)
  return credits > 0n && duffs === 0n ? '<0.001' : davToDashCompact(duffs)
}

export function chartDate(date: Date, full = false): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(full ? { year: 'numeric' } : {}) })
}
