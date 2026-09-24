import { STAT_ACTIVITY_DAYS, STAT_CHART_HEIGHT, STAT_CHART_WIDTH, STAT_DAY_MS, STAT_PRECISE_CREDIT_LIMIT } from '../constants/dashboardStats'
import type { StatActivityDay, StatActivitySummary, StatAddressUsage, StatChartSeries, StatFlowSource } from '../types/DashboardStats'
import type { PlatformAddressDto, PlatformTransaction, WalletAddressDto } from '../api/types'
import type { StatsTx } from './dashboardStats'
import { activityDayKey, chartRatio } from './dashboardAnalytics'
import { creditsToDash, creditsToDuffs, davToDashCompact, duffsToCredits } from './balance'

export function summarizeStatAddresses(
  core: Pick<WalletAddressDto, 'address' | 'isUsed'>[],
  platform: PlatformAddressDto[],
): StatAddressUsage[] {
  const coreAddresses = [...new Map(core.map(address => [address.address, address])).values()]
  const evoAddresses = [...new Map(platform.map(address => [address.platformAddress, address])).values()]
  return [
    { source: 'core', used: coreAddresses.filter(address => address.isUsed).length, total: coreAddresses.length },
    { source: 'evo', used: evoAddresses.filter(address => address.balanceCredits > 0n || address.nonce > 0).length, total: evoAddresses.length },
  ]
}

export function buildStatFlows(core: StatsTx[], platform: PlatformTransaction[], now = new Date()): StatFlowSource[] {
  const evo: StatsTx[] = [...new Map(platform.map(tx => [tx.hash.toLowerCase(), tx])).values()]
    .filter(tx => tx.netCredits !== 0n)
    // Explorer amounts include applied fees even when a transition failed.
    .map(tx => ({
      amount: tx.amountCredits,
      direction: tx.netCredits > 0n ? 'in' : 'out',
      status: 'success',
      date: tx.date,
    }))
  return [core.map(tx => ({ ...tx, amount: duffsToCredits(tx.amount) })), evo].map((transactions, index) => {
    let received = 0n
    let sent = 0n
    for (const tx of transactions) {
      if (tx.status === 'failed') continue
      if (tx.direction === 'in') received += tx.amount
      else sent += tx.amount
    }
    return { source: index === 0 ? 'core' : 'evo', received, sent, days: buildStatActivity(transactions, now) }
  })
}

export function formatStatCredits(credits: bigint): string {
  return credits > 0n && credits < STAT_PRECISE_CREDIT_LIMIT ? creditsToDash(credits) : davToDashCompact(creditsToDuffs(credits))
}

export function buildStatChartSeries(flows: StatFlowSource[], direction: 'received' | 'sent'): StatChartSeries[] {
  const series = flows.map(flow => {
    const values = flow.days.map(day => day[direction])
    const cumulative = statCumulativeAmounts(values)
    return { source: flow.source, values, total: cumulative.at(-1) ?? 0n, readings: direction === 'received' ? cumulative : values }
  })
  const max = series.reduce((peak, item) => item.readings.reduce((highest, value) => value > highest ? value : highest, peak), 0n)
  return series.map(item => ({
    source: item.source,
    total: item.total,
    readings: item.readings,
    path: direction === 'received' ? statCumulativePath(item.values, max) : statDailyPath(item.values, max),
  }))
}

export function summarizeStatActivity(
  core: Pick<StatsTx, 'date'>[],
  platform: Pick<PlatformTransaction, 'hash' | 'date'>[],
  now = new Date(),
): StatActivitySummary {
  const evo = [...new Map(platform.map(tx => [tx.hash.toLowerCase(), tx])).values()]
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - STAT_ACTIVITY_DAYS + 1)
  const summary: StatActivitySummary = {
    coreCount: core.length, evoCount: evo.length, core30d: 0, evo30d: 0,
    firstDate: null, lastDate: null, lastSource: null, ageDays: 0,
  }
  for (const source of ['Core', 'Evo'] as const) {
    for (const tx of source === 'Core' ? core : evo) {
      if (!Number.isFinite(tx.date.getTime()) || tx.date.getTime() <= 0 || tx.date > now) continue
      if (!summary.firstDate || tx.date < summary.firstDate) summary.firstDate = tx.date
      if (!summary.lastDate || tx.date >= summary.lastDate) {
        summary.lastDate = tx.date
        summary.lastSource = source
      }
      if (tx.date >= cutoff) {
        if (source === 'Core') summary.core30d++
        else summary.evo30d++
      }
    }
  }
  if (summary.firstDate) summary.ageDays = Math.floor((now.getTime() - summary.firstDate.getTime()) / STAT_DAY_MS)
  return summary
}

export function buildStatActivity(transactions: StatsTx[], now = new Date()): StatActivityDay[] {
  const days = Array.from({ length: STAT_ACTIVITY_DAYS }, (_, index) => ({
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - STAT_ACTIVITY_DAYS + 1 + index),
    received: 0n,
    sent: 0n,
  }))
  const buckets = new Map(days.map(day => [activityDayKey(day.date), day]))
  for (const tx of transactions) {
    if (tx.status === 'failed' || tx.date > now) continue
    const day = buckets.get(activityDayKey(tx.date))
    if (!day) continue
    if (tx.direction === 'in') day.received += tx.amount
    else day.sent += tx.amount
  }
  return days
}

export function statShare(value: number, total: number): number {
  return total > 0 ? Math.min(100, Math.max(0, value / total * 100)) : 0
}

export function statCumulativeAmounts(values: bigint[]): bigint[] {
  let accumulated = 0n
  return values.map(value => {
    accumulated += value
    return accumulated
  })
}

export function statCumulativePath(values: bigint[], max?: bigint): string {
  const cumulative = statCumulativeAmounts(values)
  const total = cumulative.at(-1) ?? 0n
  let path = `M 0 ${STAT_CHART_HEIGHT}`
  cumulative.forEach((value, index) => {
    const x = (index + 1) / values.length * STAT_CHART_WIDTH
    const y = (1 - chartRatio(value, max ?? total)) * STAT_CHART_HEIGHT
    path += ` H ${x} V ${y}`
  })
  return path
}

export function statDailyPath(values: bigint[], max: bigint): string {
  return values.map((value, index) => {
    const x = (index + 0.5) / values.length * STAT_CHART_WIDTH
    const y = (1 - chartRatio(value, max)) * STAT_CHART_HEIGHT
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
}
