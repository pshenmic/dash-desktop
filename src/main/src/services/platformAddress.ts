import { base58 } from '@scure/base'
import { PlatformAddressWASM } from 'pshenmic-dpp'
import { Network } from '../types'

const BASE58_ADDRESS_LENGTH = 25
const HASH160_LENGTH = 20
const PLATFORM_P2PKH_TYPE_BYTE = 0x00

export function coreAddressToPlatformAddress(coreAddress: string, network: Network): string {
  const decoded = base58.decode(coreAddress)
  if (decoded.length !== BASE58_ADDRESS_LENGTH) {
    throw new Error(`Invalid base58 address: ${coreAddress}`)
  }

  const raw = new Uint8Array(1 + HASH160_LENGTH)
  raw[0] = PLATFORM_P2PKH_TYPE_BYTE
  raw.set(decoded.slice(1, 1 + HASH160_LENGTH), 1)

  return PlatformAddressWASM.fromBytes(raw).toBech32m(network)
}
