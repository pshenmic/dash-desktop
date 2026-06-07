const DUFFS_PER_DASH = 100_000_000n

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
