import type { WalletAddressDto } from '../api/types'

export function isUsedCoreAddress(address: Pick<WalletAddressDto, 'isUsed' | 'txCount'>): boolean {
  return address.isUsed || address.txCount > 0
}
