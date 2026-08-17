// Txids and block hashes travel the wire in internal byte order and are shown
// in the reverse. Every conversion between the two lives here.

export function displayHexToWire(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(hex.length - (i + 1) * 2, hex.length - i * 2), 16)
  }
  return out
}

export function wireToDisplayHex(wire: Uint8Array): string {
  let out = ''
  for (let i = wire.length - 1; i >= 0; i--) out += wire[i]!.toString(16).padStart(2, '0')
  return out
}

export function reverseHex(hex: string): string {
  let out = ''
  for (let i = hex.length - 2; i >= 0; i -= 2) out += hex.slice(i, i + 2)
  return out
}
