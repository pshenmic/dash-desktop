import {wireToDisplayHex} from './byteOrder'
import {x11Wire} from './x11'

export function bitsToTarget(bits: number): bigint {
  const exponent = bits >>> 24
  const mantissa = BigInt(bits & 0x007fffff)
  return exponent <= 3
    ? mantissa >> BigInt(8 * (3 - exponent))
    : mantissa << BigInt(8 * (exponent - 3))
}

// Inverse of bitsToTarget, mirroring arith_uint256::GetCompact: 0x00800000 is
// reserved as a sign flag, so a mantissa that would set it shifts down a byte.
export function targetToCompact(target: bigint): number {
  if (target <= 0n) return 0
  let size = (target.toString(16).length + 1) >> 1
  let compact = size <= 3
    ? Number(target << BigInt(8 * (3 - size)))
    : Number((target >> BigInt(8 * (size - 3))) & 0xffffffn)
  if (compact & 0x00800000) {
    compact >>= 8
    size++
  }
  return ((size << 24) | compact) >>> 0
}

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
