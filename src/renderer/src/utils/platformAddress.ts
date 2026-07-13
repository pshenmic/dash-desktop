import { bech32m } from '@scure/base'
import { AddressNetwork } from './address'

const HRP: Record<AddressNetwork, string> = {
  mainnet: 'dash',
  testnet: 'tdash',
}

// type byte (0x00 P2PKH / 0x01 P2SH) + 20-byte hash
const PAYLOAD_BYTES = 21

export function isValidPlatformAddress(address: string, network?: AddressNetwork): boolean {
  const a = address.trim()
  if (a.length === 0) return false

  let decoded: { prefix: string; words: number[] }
  try {
    decoded = bech32m.decode(a as `${string}1${string}`, 90)
  } catch {
    return false
  }

  const prefixOk = network
    ? decoded.prefix === HRP[network]
    : decoded.prefix === HRP.mainnet || decoded.prefix === HRP.testnet
  if (!prefixOk) return false

  try {
    return bech32m.fromWords(decoded.words).length === PAYLOAD_BYTES
  } catch {
    return false
  }
}
