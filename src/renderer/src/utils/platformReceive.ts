import type { PlatformAddressDto } from '../api/types'

export function isUnusedPlatformAddress(address: PlatformAddressDto): boolean {
  return address.nonce === 0 && BigInt(address.balanceCredits) === 0n
}

export function defaultReceivePlatformAddress(addresses: PlatformAddressDto[]): PlatformAddressDto | undefined {
  return addresses.find(isUnusedPlatformAddress) ?? addresses[0]
}
