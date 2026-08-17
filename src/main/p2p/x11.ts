// @ts-ignore — no bundled types for @dashevo/x11-hash-js
import x11 from '@dashevo/x11-hash-js'

// Dash's block-header hash, in wire byte order. The library rejects a bare
// Uint8Array (it tests for Buffer.isBuffer), so the bytes are wrapped in a view
// rather than copied out.
export function x11Wire(raw: Uint8Array): Uint8Array {
  const buf = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Uint8Array((x11 as any).digest(buf, 1, 1) as number[])
}
