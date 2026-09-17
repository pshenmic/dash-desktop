import { base58, bech32m } from '@scure/base'
import type { ContactKind, Network } from '../api/types'
import { DestinationKind } from '../enums/DestinationKind'
import { IDENTITY_CONTACT_BYTES, SHIELDED_CONTACT_BYTES, SHIELDED_CONTACT_TYPE } from '../constants/addressBook'
import type { AddressUsage } from '../types/AddressBook'
import { isValidDashAddress } from './address'
import { isValidPlatformAddress } from './platformAddress'

export function getAddressKind(address: string, network?: Network): DestinationKind | null {
  const value = address.trim()
  if (isValidDashAddress(value, network)) return DestinationKind.CoreAddress
  if (isValidPlatformAddress(value, network)) return DestinationKind.PlatformAddress
  try {
    const decoded = bech32m.decode(value as `${string}1${string}`, 120)
    const bytes = bech32m.fromWords(decoded.words)
    const prefix = network === 'mainnet' ? 'dash' : network === 'testnet' ? 'tdash' : null
    if ((prefix ? decoded.prefix === prefix : ['dash', 'tdash'].includes(decoded.prefix))
      && bytes.length === SHIELDED_CONTACT_BYTES && bytes[0] === SHIELDED_CONTACT_TYPE) return DestinationKind.Shielded
  } catch { /* Try the other supported encoding. */ }
  try {
    if (base58.decode(value).length === IDENTITY_CONTACT_BYTES) return DestinationKind.Identity
  } catch { /* Unsupported address format. */ }
  return null
}

export function addressKey(address: string): string {
  const value = address.trim()
  const kind = getAddressKind(value)
  return kind === DestinationKind.PlatformAddress || kind === DestinationKind.Shielded ? value.toLowerCase() : value
}

export function getContactKind(address: string, network?: Network): ContactKind | null {
  const kind = getAddressKind(address, network)
  if (kind === DestinationKind.CoreAddress) return 'core'
  if (kind === DestinationKind.PlatformAddress) return 'platform'
  return kind === DestinationKind.Shielded || kind === DestinationKind.Identity ? kind : null
}

export function matchesAddressUsage(usage: AddressUsage, balance: bigint | null, used: boolean): boolean {
  return usage === 'used' ? used : usage !== 'balance' || balance === null || balance > 0n
}
