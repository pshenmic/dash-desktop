import { CREDITS_PER_DASH, CREDITS_PER_DUFF, DASH_CREDIT_DECIMALS, DUFFS_PER_DASH } from '../constants/balance'

export function creditsToDash(credits: bigint): string {
  const sign = credits < 0n ? '-' : ''
  const abs = credits < 0n ? -credits : credits
  const whole = abs / CREDITS_PER_DASH
  const fraction = abs % CREDITS_PER_DASH
  if (fraction === 0n) return `${sign}${whole}`
  const digits = fraction.toString().padStart(DASH_CREDIT_DECIMALS, '0').replace(/0+$/, '')
  return `${sign}${whole}.${digits}`
}

export function dashToCredits(value: string): bigint | null {
  if (/[^0-9.]/.test(value)) return null
  const [whole = '', fraction = '', extra] = value.split('.')
  if (extra !== undefined || fraction.length > DASH_CREDIT_DECIMALS) return null
  return BigInt(whole || '0') * CREDITS_PER_DASH
    + BigInt(fraction.padEnd(DASH_CREDIT_DECIMALS, '0'))
}

export function creditsToDuffs(credits: bigint): bigint {
  const sign = credits < 0n ? -1n : 1n
  const abs = credits < 0n ? -credits : credits
  return sign * (abs / CREDITS_PER_DUFF)
}

export function compareBigIntsDescending(a: bigint, b: bigint): number {
  if (a < b) return 1
  if (a > b) return -1
  return 0
}

export function duffsToCredits(duffs: bigint): bigint {
  return duffs * CREDITS_PER_DUFF
}

export function formatCredits(value: bigint | number): string {
  return value.toLocaleString('en-US')
}

export function formatCompactCredits(value: bigint): string {
  const sign = value < 0n ? '-' : ''
  const abs = value < 0n ? -value : value
  const UNITS = [
    { threshold: 1_000_000_000_000n, suffix: 'T' },
    { threshold: 1_000_000_000n, suffix: 'B' },
    { threshold: 1_000_000n, suffix: 'M' },
  ] as const
  for (const { threshold, suffix } of UNITS) {
    if (abs >= threshold) {
      const whole = abs / threshold
      const rem = abs % threshold
      const decimal = (rem * 10n) / threshold
      return decimal === 0n
        ? `${sign}${whole}${suffix}`
        : `${sign}${whole}.${decimal}${suffix}`
    }
  }
  return `${sign}${abs}`
}

export function davToDash(duffs: bigint): string {
  const sign = duffs < 0n ? "-" : ""
  const abs = duffs < 0n ? -duffs : duffs
  const whole = abs / DUFFS_PER_DASH
  const frac = abs % DUFFS_PER_DASH
  if (frac === 0n) return `${sign}${whole}`
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "")
  return `${sign}${whole}.${fracStr}`
}

export function davToDashCompact(duffs: bigint, maxFractionDigits = 3): string {
  const sign = duffs < 0n ? '-' : ''
  const abs = duffs < 0n ? -duffs : duffs
  const whole = abs / DUFFS_PER_DASH
  const frac = abs % DUFFS_PER_DASH
  const fracStr = frac.toString().padStart(8, '0').slice(0, maxFractionDigits).replace(/0+$/, '')
  if (whole === 0n && fracStr === '' && abs > 0n) {
    return `${sign}<0.${'0'.repeat(maxFractionDigits - 1)}1`
  }
  return fracStr === '' ? `${sign}${whole}` : `${sign}${whole}.${fracStr}`
}

export function dashToDuffs(value: string): bigint {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '.') return 0n
  if (!/^\d*\.?\d*$/.test(trimmed)) return 0n

  const [wholePart = '', fracPart = ''] = trimmed.split('.')
  const whole = wholePart === '' ? 0n : BigInt(wholePart)
  const fracDigits = fracPart.slice(0, 8).padEnd(8, '0')
  const frac = fracDigits === '' ? 0n : BigInt(fracDigits)

  return whole * DUFFS_PER_DASH + frac
}
