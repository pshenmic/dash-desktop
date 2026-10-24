export const MINUTE_MS = 60_000

export const HOUR_MS = 3_600_000

export const DAY_MS = 86_400_000

export const MONTH_DAYS = 30

export const YEAR_DAYS = 365

export const NOW_TICK_MS = 60_000

export const TIME_UNIT_PAD = 2

export const TIME_LEFT_COPY = {
  ended: 'Ended',
  underMinute: '<1m',
  justNow: 'just now',
  ago: 'ago',
} as const

export const TIME_UNIT_SUFFIX = {
  minute: 'm',
  hour: 'h',
  day: 'd',
  month: 'mo',
  year: 'y',
} as const
