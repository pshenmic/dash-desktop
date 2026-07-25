import type { PlatformAddressDto, WalletAddressDto } from '../api/types'

export function isUnusedPlatformAddress(address: PlatformAddressDto): boolean {
  return address.nonce === 0 && BigInt(address.balanceCredits) === 0n
}

export function defaultReceivePlatformAddress(addresses: PlatformAddressDto[]): PlatformAddressDto | undefined {
  return addresses.find(isUnusedPlatformAddress)
    ?? addresses.find((a) => BigInt(a.balanceCredits) === 0n)
    ?? addresses[0]
}

export function defaultReceiveCoreAddress(
  addresses: WalletAddressDto[],
  preferred?: string | null,
): WalletAddressDto | undefined {
  const preferredMatch = addresses.find((a) => a.address === preferred)
  if (preferredMatch != null && preferredMatch.balance === 0n) {
    return preferredMatch
  }
  return addresses.find((a) => a.balance === 0n) ?? addresses[0]
}

export function defaultReceiveShieldedAddress(
  addresses: string[],
  balances: Map<string, bigint>,
): string | undefined {
  return addresses.find((a) => (balances.get(a) ?? 0n) === 0n) ?? addresses[0]
}
