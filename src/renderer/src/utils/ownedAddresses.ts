import type { GetAddressesResponse, PlatformAddressDto } from '@renderer/api/types'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'

export function coreOwnedAddresses(walletId: string | undefined, addresses: GetAddressesResponse): Set<string> {
  return new Set([...addresses.receiving, ...addresses.change]
    .filter(address => address.walletId === walletId && address.address !== '')
    .map(address => address.address))
}

export function platformOwnedParticipants(addresses: PlatformAddressDto[], identities: Pick<IdentityApiDto, 'identifier'>[]): Set<string> {
  return new Set([
    ...addresses.map(address => address.platformAddress),
    ...identities.map(identity => identity.identifier),
  ].filter(Boolean))
}
