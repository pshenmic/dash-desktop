import type { ReactNode } from 'react'
import type { PlatformTransaction } from '../api/types'
import type { WalletTxItem } from './WalletTransaction'

export type AnalyticsPeriod = 7 | 30 | 90 | 'all'
export type AnalyticsCoreTransaction = Pick<WalletTxItem, 'id' | 'date' | 'status' | 'direction' | 'amount'>

export interface ActivityDay {
  key: string
  date: Date
  received: bigint
  sent: bigint
  core: number
  evo: number
}

export interface EvoTypeCount {
  type: string
  label: string
  count: number
}

export interface DashboardAnalytics {
  days: ActivityDay[]
  types: EvoTypeCount[]
  received: bigint
  sent: bigint
  coreCount: number
  evoCount: number
  undatedCount: number
}

export interface DashboardAnalyticsProps {
  core: AnalyticsCoreTransaction[]
  platform: PlatformTransaction[]
  platformFailed: boolean
  hidden: boolean
}

export interface ChartCardProps {
  title: string
  description: string
  children: ReactNode
  className?: string
}

export interface DailyChartProps {
  days: ActivityDay[]
  mode: 'flow' | 'count'
}

export interface ChartSeries {
  key: 'received' | 'sent' | 'core' | 'evo'
  label: string
  color: string
}

export interface ChartScale {
  max: bigint
  ticks: bigint[]
}
