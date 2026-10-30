import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  MONTH_DAYS,
  TIME_LEFT_COPY,
  TIME_UNIT_PAD,
  TIME_UNIT_SUFFIX,
  YEAR_DAYS,
} from '@renderer/constants/timeLeft'

function padUnit(value: number): string {
  return String(value).padStart(TIME_UNIT_PAD, '0')
}

export function formatTimeLeft(endsAt: number, now: number): string {
  const left = endsAt - now
  if (left <= 0) return TIME_LEFT_COPY.ended
  if (left < MINUTE_MS) return TIME_LEFT_COPY.underMinute
  if (left < HOUR_MS) return `${Math.floor(left / MINUTE_MS)}${TIME_UNIT_SUFFIX.minute}`
  if (left < DAY_MS) {
    const minutes = Math.floor((left % HOUR_MS) / MINUTE_MS)
    return `${Math.floor(left / HOUR_MS)}${TIME_UNIT_SUFFIX.hour} ${padUnit(minutes)}${TIME_UNIT_SUFFIX.minute}`
  }
  const hours = Math.floor((left % DAY_MS) / HOUR_MS)
  return `${Math.floor(left / DAY_MS)}${TIME_UNIT_SUFFIX.day} ${padUnit(hours)}${TIME_UNIT_SUFFIX.hour}`
}

export function formatAgo(timestamp: number, now: number): string {
  const elapsed = now - timestamp
  if (elapsed < MINUTE_MS) return TIME_LEFT_COPY.justNow
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}${TIME_UNIT_SUFFIX.minute} ${TIME_LEFT_COPY.ago}`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}${TIME_UNIT_SUFFIX.hour} ${TIME_LEFT_COPY.ago}`
  const days = Math.floor(elapsed / DAY_MS)
  if (days < MONTH_DAYS) return `${days}${TIME_UNIT_SUFFIX.day} ${TIME_LEFT_COPY.ago}`
  if (days < YEAR_DAYS) return `${Math.floor(days / MONTH_DAYS)}${TIME_UNIT_SUFFIX.month} ${TIME_LEFT_COPY.ago}`
  return `${Math.floor(days / YEAR_DAYS)}${TIME_UNIT_SUFFIX.year} ${TIME_LEFT_COPY.ago}`
}
