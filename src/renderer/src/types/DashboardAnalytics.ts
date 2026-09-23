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
  days: CoreBalanceDay[]
}

export interface CoreBalanceDay {
  key: string
  date: Date
  balance: bigint
}

export interface CoreBalanceChartProps {
  core: AnalyticsCoreTransaction[]
  days: ActivityDay[]
  hidden: boolean
}

export interface ChartScale {
  min: bigint
  max: bigint
  ticks: bigint[]
}

export interface BalanceSegment {
  label: string
  color: string
  credits: bigint
  share: number
  offset: number
}

export interface BalanceAllocation {
  total: bigint
  segments: BalanceSegment[]
}
