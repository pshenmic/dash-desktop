import type { PlatformAddressDto, WalletAddressDto } from '../api/types'

export function isUnusedPlatformAddress(address: PlatformAddressDto): boolean {
  return address.nonce === 0 && address.balanceCredits === 0n
}

export function receivePlatformAddresses(addresses: PlatformAddressDto[]): PlatformAddressDto[] {
  return addresses.filter(isUnusedPlatformAddress)
}

export function defaultReceivePlatformAddress(addresses: PlatformAddressDto[]): PlatformAddressDto | undefined {
  return receivePlatformAddresses(addresses)[0]
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
  return receiveShieldedAddresses(addresses, balances)[0]
}

export function receiveShieldedAddresses(
  addresses: string[],
  balances: Map<string, bigint>,
): string[] {
  return addresses.filter((address) => (balances.get(address) ?? 0n) === 0n)
}
