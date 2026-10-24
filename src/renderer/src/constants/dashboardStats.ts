import type { TransactionKind } from '../types/TransactionKindBadge'

export const STAT_ACTIVITY_DAYS = 30
export const STAT_CHART_WIDTH = 240
export const STAT_CHART_HEIGHT = 40
export const STAT_PLOT_HEIGHT = 'h-10'
export const STAT_DAY_MS = 86_400_000
export const STAT_FLOW_LABELS = { core: 'Core', evo: 'Evo' }
export const STAT_PRECISE_CREDIT_LIMIT = 100_000_000n
export const STAT_SOURCE_KIND: Record<'core' | 'evo', TransactionKind> = { core: 'core', evo: 'platform' }
export const STAT_ACTIVITY_SOURCE_KIND: Record<'Core' | 'Evo', TransactionKind> = { Core: 'core', Evo: 'platform' }
