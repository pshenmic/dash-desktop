import {wireToDisplayHex} from './byteOrder'
import {POW_LIMIT_BITS} from './constants'
import {x11Wire} from './x11'

export function bitsToTarget(bits: number): bigint {
  const exponent = bits >>> 24
  const mantissa = BigInt(bits & 0x007fffff)
  return exponent <= 3
    ? mantissa >> BigInt(8 * (3 - exponent))
    : mantissa << BigInt(8 * (exponent - 3))
}

export const POW_LIMIT_TARGET = bitsToTarget(POW_LIMIT_BITS)

// Expected hashes to satisfy `bits`. A longer branch can carry less work, so
// branch selection compares this rather than height.
export function headerWork(bits: number): bigint {
  const target = bitsToTarget(bits)
  if (target <= 0n) return 0n
  return ((1n << 256n) - target - 1n) / (target + 1n) + 1n
}

// Bytes 4..35 of a header are its parent's hash, in wire order.
export function rawPrevHash(raw: Uint8Array): string {
  return wireToDisplayHex(raw.subarray(4, 36))
}

export function hashHeaderRaw(raw: Uint8Array): string {
  return wireToDisplayHex(x11Wire(raw))
}
