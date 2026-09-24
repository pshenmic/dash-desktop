// Consensus keys address inputs and outputs in a BTreeMap over the 21-byte
// PlatformAddress, so a fee strategy index resolves against this order.
export function compareAddressBytes(left: Uint8Array, right: Uint8Array): number {
  const shared = Math.min(left.length, right.length)
  for (let i = 0; i < shared; i++) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return left.length - right.length
}
