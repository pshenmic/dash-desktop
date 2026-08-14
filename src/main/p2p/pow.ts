// @ts-ignore — no bundled types for @dashevo/x11-hash-js
import x11 from '@dashevo/x11-hash-js'

import {POW_LIMIT_BITS} from './constants'

export function bitsToTarget(bits: number): bigint {
  const exponent = bits >>> 24
  const mantissa = BigInt(bits & 0x007fffff)
  return exponent <= 3
    ? mantissa >> BigInt(8 * (3 - exponent))
    : mantissa << BigInt(8 * (exponent - 3))
}

export const POW_LIMIT_TARGET = bitsToTarget(POW_LIMIT_BITS)

// Expected hashes to satisfy `bits`, the comparable unit for branch selection.
// Height is not a substitute: a branch can be longer and still carry less work.
export function headerWork(bits: number): bigint {
  const target = bitsToTarget(bits)
  if (target <= 0n) return 0n
  return ((1n << 256n) - target - 1n) / (target + 1n) + 1n
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