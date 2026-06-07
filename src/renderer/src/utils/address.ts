import { createBase58check } from '@scure/base'
import { sha256 } from '@noble/hashes/sha2.js'

const base58check = createBase58check(sha256)

export type AddressNetwork = 'mainnet' | 'testnet'

const VERSION_BYTES: Record<AddressNetwork, { p2pkh: number; p2sh: number }> = {
  mainnet: { p2pkh: 76, p2sh: 16 },
  testnet: { p2pkh: 140, p2sh: 19 },
}

const ALL_VERSION_BYTES = new Set(
  Object.values(VERSION_BYTES).flatMap((v) => [v.p2pkh, v.p2sh])
)

function decodeVersion(address: string): number | null {
  const trimmed = address.trim()
  if (trimmed.length === 0) return null
  let data: Uint8Array
  try {
    data = base58check.decode(trimmed)
  } catch {
    return null
  }
  if (data.length !== 21) return null
  return data[0]
}

export function isValidDashAddress(address: string, network?: AddressNetwork): boolean {
  const version = decodeVersion(address)
  if (version === null) return false
  if (network) {
    const { p2pkh, p2sh } = VERSION_BYTES[network]
    return version === p2pkh || version === p2sh
  }
  return ALL_VERSION_BYTES.has(version)
}

export function dashAddressNetwork(address: string): AddressNetwork | null {
  const version = decodeVersion(address)
  if (version === null) return null
  for (const network of Object.keys(VERSION_BYTES) as AddressNetwork[]) {
    const { p2pkh, p2sh } = VERSION_BYTES[network]
    if (version === p2pkh || version === p2sh) return network
  }
  return null
}

export function shortenAddress(address: string, head = 8, tail = 6): string {
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}
