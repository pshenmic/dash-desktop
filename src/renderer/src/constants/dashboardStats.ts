export const STAT_ACTIVITY_DAYS = 30
export const STAT_CHART_WIDTH = 240
export const STAT_CHART_HEIGHT = 40
export const STAT_DAY_MS = 86_400_000
export const STAT_FLOW_LABELS = { core: 'Core', evo: 'Evo' }
export const STAT_FLOW_COLORS = { core: 'var(--stat-brand)', evo: 'var(--stat-evo)' }
export const STAT_PRECISE_CREDIT_LIMIT = 100_000_000n
export const STAT_TONE_CLASSES = {
  brand: '[--stat-accent:var(--stat-brand)]',
  green: '[--stat-accent:var(--stat-received)]',
  orange: '[--stat-accent:var(--stat-sent)]',
}
export const STAT_SOURCE_CLASSES = {
  core: '[--stat-series:var(--stat-brand)]',
  evo: '[--stat-series:var(--stat-evo)]',
}
