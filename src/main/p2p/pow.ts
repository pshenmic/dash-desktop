// @ts-ignore — no bundled types for @dashevo/x11-hash-js
import x11 from '@dashevo/x11-hash-js'

export const POW_LIMIT_BITS = 0x1e0fffff
export const MAX_FUTURE_BLOCK_TIME = 2 * 60 * 60

export const DGW_PAST_BLOCKS = 24
export const DGW_TARGET_SPACING = 150
export const DGW_TARGET_TIMESPAN = DGW_PAST_BLOCKS * DGW_TARGET_SPACING

export function bitsToTarget(bits: number): bigint {
  const exponent = bits >>> 24
  const mantissa = BigInt(bits & 0x007fffff)
  return exponent <= 3
    ? mantissa >> BigInt(8 * (3 - exponent))
    : mantissa << BigInt(8 * (exponent - 3))
}

export const POW_LIMIT_TARGET = bitsToTarget(POW_LIMIT_BITS)

// Inverse of bitsToTarget. Mirrors arith_uint256::GetCompact — the 0x00800000
// bit is reserved as a sign flag, so when the top byte of the 3-byte mantissa
// would set it we shift right by one byte and bump the exponent.
export function targetToCompact(target: bigint): number {
  if (target <= 0n) return 0
  let bits = 0
  for (let t = target; t > 0n; t >>= 1n) bits++
  let size = (bits + 7) >> 3
  let compact: number
  if (size <= 3) {
    compact = Number(target << BigInt(8 * (3 - size)))
  } else {
    compact = Number(target >> BigInt(8 * (size - 3)))
  }
  if (compact & 0x00800000) {
    compact >>>= 8
    size++
  }
  return ((size << 24) | (compact & 0x007fffff)) >>> 0
}

// DarkGravityWave v3 — weighted running average of the last 24 targets,
// rescaled by the observed timespan clamped to [1/3x, 3x] of the ideal.
// Mirrors src/pow.cpp::DarkGravityWave in Dash Core. `history` is
// oldest-to-newest of length DGW_PAST_BLOCKS.
export function dgwv3ExpectedBits(history: Array<{ time: number; nBits: number }>): number {
  const n = history.length
  let bnPastTargetAvg = 0n
  for (let i = 1; i <= n; i++) {
    const bnTarget = bitsToTarget(history[n - i]!.nBits)
    bnPastTargetAvg = i === 1
      ? bnTarget
      : (bnPastTargetAvg * BigInt(i) + bnTarget) / BigInt(i + 1)
  }
  let bnNew = bnPastTargetAvg
  const newest = history[n - 1]!
  const oldest = history[0]!
  let nActualTimespan = newest.time - oldest.time
  const lo = Math.floor(DGW_TARGET_TIMESPAN / 3)
  const hi = DGW_TARGET_TIMESPAN * 3
  if (nActualTimespan < lo) nActualTimespan = lo
  if (nActualTimespan > hi) nActualTimespan = hi
  bnNew = (bnNew * BigInt(nActualTimespan)) / BigInt(DGW_TARGET_TIMESPAN)
  if (bnNew > POW_LIMIT_TARGET) bnNew = POW_LIMIT_TARGET
  return targetToCompact(bnNew)
}

export function bytesToHexReversed(bytes: Uint8Array): string {
  let out = ''
  for (let i = bytes.length - 1; i >= 0; i--) out += bytes[i]!.toString(16).padStart(2, '0')
  return out
}

export function rawPrevHash(raw: Uint8Array): string {
  let out = ''
  for (let i = 35; i >= 4; i--) out += raw[i]!.toString(16).padStart(2, '0')
  return out
}

export function hashHeaderRaw(raw: Uint8Array): string {
  const digest = (x11 as any).digest([...raw], 1, 1) as number[]
  let hex = ''
  for (let i = digest.length - 1; i >= 0; i--) hex += digest[i]!.toString(16).padStart(2, '0')
  return hex
}
