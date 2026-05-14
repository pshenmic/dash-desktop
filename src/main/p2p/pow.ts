// @ts-ignore — no bundled types for @dashevo/x11-hash-js
import x11 from '@dashevo/x11-hash-js'

export const POW_LIMIT_BITS = 0x1e0fffff
export const MAX_FUTURE_BLOCK_TIME = 2 * 60 * 60

export function bitsToTarget(bits: number): bigint {
  const exponent = bits >>> 24
  const mantissa = BigInt(bits & 0x007fffff)
  return exponent <= 3
    ? mantissa >> BigInt(8 * (3 - exponent))
    : mantissa << BigInt(8 * (exponent - 3))
}

export const POW_LIMIT_TARGET = bitsToTarget(POW_LIMIT_BITS)

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