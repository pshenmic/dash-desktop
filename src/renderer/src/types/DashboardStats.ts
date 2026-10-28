import type { ReactNode } from 'react'
import type { StatsTx } from '../utils/dashboardStats'
import type { PlatformTransaction } from '../api/types'
import type { ActivityDay, AnalyticsPeriod } from './DashboardAnalytics'
import type { TransactionKind } from './TransactionKindBadge'

export interface SourceBadgeProps {
  kind: TransactionKind
}

export interface MetricRowProps {
  lead: ReactNode
  value: ReactNode
  aside?: ReactNode
  asideClassName?: string
}

export interface StatisticsProps {
  transactions: StatsTx[]
  platform: PlatformTransaction[]
  platformFailed: boolean
  period: AnalyticsPeriod
  days: ActivityDay[]
}

export interface StatVolumeChartProps {
  flows: StatFlowSource[]
  direction: 'received' | 'sent'
  hidden: boolean
  period: AnalyticsPeriod
}

export interface StatFlowSource {
  source: 'core' | 'evo'
  received: bigint
  sent: bigint
  largestReceived: bigint
  days: StatActivityDay[]
}

export interface StatFlowAmountsProps {
  flows: StatFlowSource[]
  metric: 'received' | 'sent' | 'largestReceived'
  hidden: boolean
  showFiat?: boolean
}

export interface StatChartSeries {
  source: StatFlowSource['source']
  total: bigint
  readings: bigint[]
  path: string
}

export interface StatAddressUsage {
  source: StatFlowSource['source']
  used: number
  total: number
}

export interface StatActivityDay {
  date: Date
  received: bigint
  sent: bigint
}

export interface StatActivitySummary {
  coreCount: number
  evoCount: number
  core30d: number
  evo30d: number
  firstDate: Date | null
  lastDate: Date | null
  lastSource: 'Core' | 'Evo' | null
  ageDays: number
}
