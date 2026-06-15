export interface StatsTx {
  amount: bigint
  direction: 'in' | 'out'
  status: 'success' | 'failed' | 'pending'
  date: Date
}

export interface MonthlyActivity {
  label: string
  year: number
  received: bigint
  sent: bigint
  count: number
}

export interface WalletStats {
  txCount: number
  receivedCount: number
  sentCount: number
  pendingCount: number
  totalReceived: bigint
  totalSent: bigint
  largestReceived: bigint
  largestSent: bigint
  firstTxDate: Date | null
  lastTxDate: Date | null
  walletAgeDays: number
  received30d: bigint
  sent30d: bigint
  netFlow30d: bigint
  monthlyActivity: MonthlyActivity[]
}

const DAY_MS = 86_400_000

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short' })
}

function monthKey(year: number, month: number): string {
  return `${year}-${month}`
}

export function computeWalletStats(
  txs: StatsTx[],
  now: Date = new Date(),
  monthsBack = 6
): WalletStats {
  const months: MonthlyActivity[] = []
  const monthIndex = new Map<string, MonthlyActivity>()
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const entry: MonthlyActivity = {
      label: monthLabel(d),
      year: d.getFullYear(),
      received: 0n,
      sent: 0n,
      count: 0
    }
    months.push(entry)
    monthIndex.set(monthKey(d.getFullYear(), d.getMonth()), entry)
  }

  const stats: WalletStats = {
    txCount: txs.length,
    receivedCount: 0,
    sentCount: 0,
    pendingCount: 0,
    totalReceived: 0n,
    totalSent: 0n,
    largestReceived: 0n,
    largestSent: 0n,
    firstTxDate: null,
    lastTxDate: null,
    walletAgeDays: 0,
    received30d: 0n,
    sent30d: 0n,
    netFlow30d: 0n,
    monthlyActivity: months
  }

  const cutoff30d = now.getTime() - 30 * DAY_MS

  for (const tx of txs) {
    if (stats.firstTxDate === null || tx.date < stats.firstTxDate) stats.firstTxDate = tx.date
    if (stats.lastTxDate === null || tx.date > stats.lastTxDate) stats.lastTxDate = tx.date
    if (tx.status === 'pending') stats.pendingCount++
    if (tx.status === 'failed') continue

    const incoming = tx.direction === 'in'
    if (incoming) {
      stats.receivedCount++
      stats.totalReceived += tx.amount
      if (tx.amount > stats.largestReceived) stats.largestReceived = tx.amount
    } else {
      stats.sentCount++
      stats.totalSent += tx.amount
      if (tx.amount > stats.largestSent) stats.largestSent = tx.amount
    }

    if (tx.date.getTime() >= cutoff30d) {
      if (incoming) stats.received30d += tx.amount
      else stats.sent30d += tx.amount
    }

    const bucket = monthIndex.get(monthKey(tx.date.getFullYear(), tx.date.getMonth()))
    if (bucket) {
      bucket.count++
      if (incoming) bucket.received += tx.amount
      else bucket.sent += tx.amount
    }
  }

  stats.netFlow30d = stats.received30d - stats.sent30d
  if (stats.firstTxDate !== null) {
    stats.walletAgeDays = Math.max(0, Math.floor((now.getTime() - stats.firstTxDate.getTime()) / DAY_MS))
  }

  return stats
}

export function formatWalletAge(days: number): string {
  if (days <= 0) return 'New'
  if (days === 1) return '1 day'
  if (days < 61) return `${days} days`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 month'
  if (months < 24) return `${months} months`
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year' : `${years} years`
}
