import type { FC, ReactNode } from 'react'
import type { IconProps } from '../components/dash-ui-kit-enxtended/icons'
import type { StatsTx } from '../utils/dashboardStats'
import type { PlatformTransaction } from '../api/types'

export type StatTone = 'brand' | 'green' | 'orange'

export interface StatCardProps {
  icon: FC<IconProps>
  iconSize?: number
  label: string
  value: ReactNode
  sub?: ReactNode
  hidden?: boolean
  tone?: StatTone
  body?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  compact?: boolean
  className?: string
}

export interface StatisticsProps {
  transactions: StatsTx[]
  platform: PlatformTransaction[]
  platformFailed: boolean
}

export interface StatVolumeChartProps {
  flows: StatFlowSource[]
  direction: 'received' | 'sent'
  hidden: boolean
  platformFailed?: boolean
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
  platformFailed: boolean
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
